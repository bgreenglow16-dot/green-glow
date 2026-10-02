import { json } from "../_shared/admin.js";
import { notifyAll } from "../_shared/push.js";
import {
  clientIp,
  forbidCrossOrigin,
  rateLimited,
  readJsonBody,
  tooManyRequests,
} from "../_shared/security.js";
import { deliveryPriceFor, getLocations, normalize } from "../_shared/zr.js";

const products = {
  oil: { name: "زيت ذكر الثوم", size: "150 مل", price: 2500 },
  laban: { name: "لبان ذكر الثوم", size: "50 غ", price: 2500 },
};
const deliveryPrices = { home: 600, desk: 400 };
const maxQuantity = 20;

function normalizeText(value, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  if (await rateLimited(env, `order:${clientIp(request)}`, 6, 600)) {
    return tooManyRequests("طلبات كثيرة في وقت قصير. حاول بعد قليل.");
  }

  const parsed = await readJsonBody(request, 10000);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "بيانات الطلب غير صحيحة." }, 400);
  }

  // Honeypot: real visitors never see or fill this field; bots do.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true, orderId: 0 });
  }

  const customerName = normalizeText(body.customerName, 120);
  const phone = normalizeText(body.phone, 24)
    .replace(/[ .-]/g, "")
    .replace(/^\+?213/, "0");
  const wilaya = normalizeText(body.wilaya, 80);
  const municipality = normalizeText(body.municipality, 100);
  const address = normalizeText(body.address, 240);
  const notes = normalizeText(body.notes, 500);
  const deliveryType = body.deliveryType;

  if (customerName.length < 3) {
    return json({ error: "أدخل الاسم الكامل." }, 400);
  }
  if (!/^0[567]\d{8}$/.test(phone)) {
    return json({ error: "رقم الهاتف غير صحيح." }, 400);
  }
  if (await rateLimited(env, `order-phone:${phone}`, 3, 3600)) {
    return tooManyRequests("تم تسجيل عدة طلبات بهذا الرقم. سنتصل بك قريبا.");
  }
  if (!wilaya || municipality.length < 2) {
    return json({ error: "أدخل الولاية والبلدية." }, 400);
  }
  if (deliveryType !== "home" && deliveryType !== "desk") {
    return json({ error: "اختر طريقة توصيل صحيحة." }, 400);
  }
  if (deliveryType === "home" && address.length < 4) {
    return json({ error: "أدخل عنوان التوصيل إلى المنزل." }, 400);
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 2) {
    return json({ error: "اختر منتجا واحدا على الأقل." }, 400);
  }

  const quantities = new Map();
  for (const item of body.items) {
    if (
      !item ||
      !Object.hasOwn(products, item.id) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return json({ error: "بيانات المنتجات غير صحيحة." }, 400);
    }
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  }

  const quantity = [...quantities.values()].reduce((sum, value) => sum + value, 0);
  if (quantity > maxQuantity) {
    return json({ error: `الحد الأقصى للطلب ${maxQuantity} قطعة.` }, 400);
  }

  const items = [...quantities].map(([id, count]) => ({
    id,
    name: products[id].name,
    size: products[id].size,
    quantity: count,
    unitPrice: products[id].price,
  }));
  const oilQuantity = quantities.get("oil") || 0;
  const giftQuantity = Math.floor(oilQuantity / 2);
  if (giftQuantity > 0) {
    items.push({
      id: "gift",
      name: "قارورة صغيرة من زيت ذكر الثوم (هدية)",
      size: "",
      quantity: giftQuantity,
      unitPrice: 0,
    });
  }

  const product = items
    .map((item) => `${item.name}${item.size ? ` (${item.size})` : ""} × ${item.quantity}`)
    .join("، ");
  const subtotal = [...quantities].reduce(
    (sum, [id, count]) => sum + products[id].price * count,
    0,
  );
  // Prefer the live ZR Express rate for the chosen commune; fall back to the flat fee if ZR is unreachable.
  let deliveryPrice = deliveryPrices[deliveryType];
  try {
    const { wilayas } = await getLocations(env);
    const wilayaInfo = wilayas.find((item) => normalize(item.nameArabic) === normalize(wilaya));
    if (!wilayaInfo) return json({ error: "لا نوصل حاليا إلى هذه الولاية." }, 400);
    const communeInfo =
      wilayaInfo.communes.find((item) => item.id === body.communeId) ||
      wilayaInfo.communes.find((item) => normalize(item.nameArabic) === normalize(municipality));
    if (!communeInfo) return json({ error: "اختر البلدية من القائمة." }, 400);
    if (deliveryType === "home" && !communeInfo.home) {
      return json({ error: "التوصيل إلى المنزل غير متاح في هذه البلدية." }, 400);
    }
    if (deliveryType === "desk" && !communeInfo.desk) {
      return json({ error: "التوصيل إلى المكتب غير متاح في هذه البلدية." }, 400);
    }
    const livePrice = deliveryPriceFor(wilayaInfo, communeInfo, deliveryType);
    if (livePrice !== null) deliveryPrice = livePrice;
  } catch (error) {
    console.error("Could not load ZR delivery rates, using flat fee:", error?.message);
  }
  const totalPrice = subtotal + deliveryPrice;

  let result;
  try {
    result = await env.DB.prepare(
      `INSERT INTO orders
        (customer_name, phone, wilaya, municipality, address, delivery_type,
         product, quantity, items_json, total_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        customerName,
        phone,
        wilaya,
        municipality,
        address,
        deliveryType === "home" ? "منزل" : "مكتب",
        product,
        quantity,
        JSON.stringify(items),
        totalPrice,
        notes,
      )
      .run();
  } catch (error) {
    console.error("Failed to save order to D1:", error);
    return json({ error: "تعذر حفظ الطلب حاليا. حاول مرة أخرى بعد قليل." }, 500);
  }

  const orderId = result.meta?.last_row_id;
  if (!orderId) {
    console.error("D1 insert completed without returning an order ID.");
    return json({ error: "لم نتمكن من تأكيد حفظ الطلب." }, 500);
  }

  // Phone notification for the manager; never allowed to affect the customer's confirmation.
  waitUntil(
    notifyAll(env, {
      title: `طلب جديد #${orderId}`,
      body: `${customerName} · ${wilaya} · ${totalPrice} دج`,
      url: "/admin/",
      tag: `order-${orderId}`,
    }).catch((error) => console.error("New-order notification failed:", error?.message)),
  );

  return json({ ok: true, orderId });
}
