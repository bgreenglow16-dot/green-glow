import { json, requireAdmin } from "../../../_shared/admin.js";
import { forbidCrossOrigin } from "../../../_shared/security.js";
import { ZrError, findParcel, isFinalState, saveShipping } from "../../../_shared/zr.js";

// Cloudflare limits subrequests per invocation, so each sync checks a bounded batch.
const MAX_PER_SYNC = 35;
const CONCURRENCY = 5;

export async function onRequestPost({ request, env }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const { results } = await env.DB.prepare(
    "SELECT id, tracking_number, shipping_state FROM orders WHERE tracking_number != '' ORDER BY id DESC LIMIT 200",
  ).all();
  const pending = results.filter((row) => !isFinalState(row.shipping_state)).slice(0, MAX_PER_SYNC);

  let checked = 0;
  let failed = 0;
  let firstError = "";
  const queue = [...pending];
  const worker = async () => {
    while (queue.length) {
      const row = queue.shift();
      try {
        const parcel = await findParcel(env, row.tracking_number);
        await saveShipping(env, row.id, parcel);
        checked += 1;
      } catch (error) {
        failed += 1;
        if (!firstError) firstError = error instanceof ZrError ? error.message : "خطأ غير متوقع";
        console.error("Shipment sync failed for order", row.id, error?.message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

  return json({ ok: true, checked, failed, skipped: results.length - pending.length, error: firstError });
}
