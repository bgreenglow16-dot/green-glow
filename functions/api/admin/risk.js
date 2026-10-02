import { json, requireAdmin } from "../../_shared/admin.js";
import { forbidCrossOrigin, readJsonBody } from "../../_shared/security.js";
import { riskFor } from "../../_shared/risk.js";
import { ZrError } from "../../_shared/zr.js";

// Each lookup is one ZR request, so a call is capped to stay inside the per-invocation subrequest limit.
const MAX_PHONES = 12;

export async function onRequestPost({ request, env }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const parsed = await readJsonBody(request, 4000);
  if (parsed.error) return parsed.error;
  const phones = [...new Set(Array.isArray(parsed.body?.phones) ? parsed.body.phones : [])]
    .filter((phone) => typeof phone === "string" && /^0[567]\d{8}$/.test(phone))
    .slice(0, MAX_PHONES);

  const risks = {};
  let firstError = "";
  for (const phone of phones) {
    try {
      risks[phone] = await riskFor(env, phone);
    } catch (error) {
      if (!firstError) firstError = error instanceof ZrError ? error.message : "خطأ غير متوقع";
      console.error("Risk lookup failed:", error?.message);
    }
  }
  return json({ risks, error: firstError });
}
