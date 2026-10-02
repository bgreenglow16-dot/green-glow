import { json, requireAdmin } from "../../_shared/admin.js";

export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, customer_name, phone, wilaya, municipality, address,
              delivery_type, product, quantity, total_price, order_date,
              status, tracking_number, notes, shipping_state, shipping_desc,
              shipping_color, shipping_checked_at
       FROM orders
       ORDER BY order_date DESC, id DESC`,
    ).all();
    return json({ orders: results });
  } catch (error) {
    console.error("Failed to load orders from D1:", error);
    return json({ error: "تعذر تحميل الطلبات." }, 500);
  }
}
