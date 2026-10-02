import { json, requireAdmin } from "../../../_shared/admin.js";
import { forbidCrossOrigin } from "../../../_shared/security.js";

const statuses = new Set(["قيد التأكيد", "مؤكد", "لم يرد 1", "لم يرد 2", "غير مجاب", "ملغى"]);

export async function onRequestPatch({ request, env, params }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return json({ error: "رقم الطلب غير صحيح." }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "تعذر قراءة التحديث." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "بيانات التحديث غير صحيحة." }, 400);
  }

  if (!statuses.has(body.status) || typeof body.trackingNumber !== "string") {
    return json({ error: "الحالة أو رقم التتبع غير صحيح." }, 400);
  }
  const trackingNumber = body.trackingNumber.trim();
  if (trackingNumber.length > 100) {
    return json({ error: "رقم التتبع أطول من المسموح." }, 400);
  }

  try {
    const result = await env.DB.prepare(
      "UPDATE orders SET status = ?, tracking_number = ? WHERE id = ?",
    )
      .bind(body.status, trackingNumber, id)
      .run();
    if (result.meta?.changes !== 1) {
      return json({ error: "لم يتم العثور على الطلب." }, 404);
    }
    if (trackingNumber === "") {
      await env.DB.prepare(
        "UPDATE orders SET shipping_state = '', shipping_desc = '', shipping_color = '', shipping_checked_at = '' WHERE id = ?",
      )
        .bind(id)
        .run();
    }
    return json({ ok: true });
  } catch (error) {
    console.error("Failed to update order in D1:", error);
    return json({ error: "تعذر تحديث الطلب." }, 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return json({ error: "رقم الطلب غير صحيح." }, 400);
  }

  try {
    const result = await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
    if (result.meta?.changes !== 1) {
      return json({ error: "لم يتم العثور على الطلب." }, 404);
    }
    return json({ ok: true });
  } catch (error) {
    console.error("Failed to delete order from D1:", error);
    return json({ error: "تعذر حذف الطلب." }, 500);
  }
}
