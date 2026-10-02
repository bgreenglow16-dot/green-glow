import { json, requireAdmin } from "../../../../_shared/admin.js";
import { ZrError, findParcel, saveShipping, zrRequest } from "../../../../_shared/zr.js";

function courierOf(parcel) {
  const person = parcel.deliveryPerson;
  if (!person || typeof person !== "object") return null;
  const name = person.name || person.fullName || [person.firstName, person.lastName].filter(Boolean).join(" ");
  const phone = person.phone?.number1 || person.phoneNumber || "";
  return name || phone ? { name: name || "", phone } : null;
}

export async function onRequestGet({ request, env, params }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return json({ error: "رقم الطلب غير صحيح." }, 400);

  const order = await env.DB.prepare("SELECT id, tracking_number FROM orders WHERE id = ?").bind(id).first();
  if (!order) return json({ error: "لم يتم العثور على الطلب." }, 404);
  if (!order.tracking_number) return json({ error: "هذا الطلب لم يُرسل إلى شركة التوصيل بعد." }, 400);

  try {
    const parcel = await findParcel(env, order.tracking_number);
    const columns = await saveShipping(env, id, parcel);
    if (!parcel) return json({ missing: true, trackingNumber: order.tracking_number, ...columns });

    let history = [];
    try {
      const raw = await zrRequest(env, `/parcels/${parcel.id}/state-history`);
      history = (Array.isArray(raw) ? raw : raw?.items || [])
        .map((entry) => ({
          at: entry.createdAt || "",
          state: entry.newState?.name || "",
          description: entry.newState?.description || "",
          color: String(entry.newState?.color || "").replace(/[^0-9a-fA-F]/g, "").slice(0, 6),
          comment: entry.comment || "",
          reasons: (entry.situations || []).map((item) => item.situationName).filter(Boolean),
          place: entry.location?.name || "",
        }))
        .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    } catch (error) {
      console.error("State history unavailable:", error?.message);
    }

    return json({
      trackingNumber: order.tracking_number,
      ...columns,
      updatedAt: parcel.lastStateUpdateAt || "",
      isReturn: Boolean(parcel.isReturn),
      amount: parcel.amount ?? null,
      deliveryPrice: parcel.deliveryPrice ?? null,
      courier: courierOf(parcel),
      history,
    });
  } catch (error) {
    if (error instanceof ZrError) return json({ error: error.message }, error.status);
    console.error("Tracking failed:", error);
    return json({ error: "تعذر جلب حالة الشحنة." }, 500);
  }
}
