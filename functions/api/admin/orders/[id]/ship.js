import { json, requireAdmin } from "../../../../_shared/admin.js";
import { forbidCrossOrigin } from "../../../../_shared/security.js";
import {
  ZrError,
  communesOf,
  findWilaya,
  loadPickupHubs,
  loadTerritories,
  matchCommune,
  toInternationalPhone,
  saveShipping,
  zrRequest,
} from "../../../../_shared/zr.js";

export async function onRequestPost({ request, env, params }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return json({ error: "رقم الطلب غير صحيح." }, 400);
  }

  const body = await request.json().catch(() => ({}));
  const chosenCommuneId = typeof body?.communeId === "string" ? body.communeId : "";

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!order) return json({ error: "لم يتم العثور على الطلب." }, 404);
  if (order.tracking_number) {
    return json({ error: `الطلب مرسل مسبقا، رقم التتبع ${order.tracking_number}.` }, 409);
  }

  try {
    const territories = await loadTerritories(env);
    const wilaya = findWilaya(territories, order.wilaya);
    const communes = communesOf(territories, wilaya);
    const commune = chosenCommuneId
      ? communes.find((item) => item.id === chosenCommuneId)
      : matchCommune(communes, order.municipality);

    if (!commune) {
      return json(
        {
          needCommune: true,
          error: `تعذر تحديد بلدية "${order.municipality}" تلقائيا. اختر البلدية الصحيحة.`,
          communes: communes.map(({ id: communeId, name, nameArabic }) => ({
            id: communeId,
            name,
            nameArabic,
          })),
        },
        409,
      );
    }

    const isDesk = order.delivery_type === "مكتب";
    let hubId;
    if (isDesk) {
      const hubs = await loadPickupHubs(env);
      const hub =
        hubs.find((item) => item.address?.districtTerritoryId === commune.id) ||
        hubs.find((item) => item.address?.cityTerritoryId === wilaya.id);
      if (!hub) {
        throw new ZrError(`لا يوجد مكتب استلام لدى ZR Express في ولاية ${order.wilaya}.`, 422);
      }
      hubId = hub.id;
    } else if (commune.delivery?.hasHomeDelivery === false) {
      throw new ZrError(`التوصيل إلى المنزل غير متاح في بلدية ${commune.nameArabic || commune.name}.`, 422);
    }

    const phone = toInternationalPhone(order.phone);
    const street = order.address || order.municipality;

    const customer = await zrRequest(env, "/customers/individual", {
      method: "POST",
      body: {
        name: order.customer_name,
        phone: { number1: phone },
        deliveryPreference: isDesk ? "pickup-point" : "home",
        addresses: [
          {
            street,
            city: wilaya.name,
            district: commune.name,
            country: "Algeria",
            cityTerritoryId: wilaya.id,
            districtTerritoryId: commune.id,
            isPrimary: true,
          },
        ],
      },
    });

    const items = JSON.parse(order.items_json || "[]");
    const parcel = await zrRequest(env, "/parcels", {
      method: "POST",
      body: {
        customer: { customerId: customer.id, name: order.customer_name, phone: { number1: phone } },
        deliveryAddress: {
          cityTerritoryId: wilaya.id,
          districtTerritoryId: commune.id,
          street,
        },
        orderedProducts: items.map((item) => ({
          productName: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          stockType: "none",
        })),
        deliveryType: isDesk ? "pickup-point" : "home",
        description: order.product.slice(0, 250),
        amount: order.total_price,
        weight: { weight: Math.max(0.3, 0.3 * order.quantity) },
        ...(hubId ? { hubId } : {}),
        externalId: `GG-${order.id}`,
      },
    });

    const created = await zrRequest(env, `/parcels/${parcel.id}`);
    const trackingNumber = String(created?.trackingNumber || "");
    if (!trackingNumber) {
      throw new ZrError(`أُنشئت الشحنة (${parcel.id}) لكن ZR لم تُرجع رقم تتبع.`, 502);
    }

    await env.DB.prepare("UPDATE orders SET tracking_number = ? WHERE id = ?")
      .bind(trackingNumber, id)
      .run();
    await saveShipping(env, id, created).catch((error) =>
      console.error("Could not store initial shipping state:", error?.message),
    );
    return json({ ok: true, trackingNumber, parcelId: parcel.id });
  } catch (error) {
    if (error instanceof ZrError) return json({ error: error.message }, error.status);
    console.error("Unexpected shipping error:", error);
    return json({ error: "تعذر إرسال الطلب إلى شركة التوصيل." }, 500);
  }
}
