import { toInternationalPhone, zrRequest } from "./zr.js";

const DELIVERED = new Set(["livre", "encaisse", "recouvert"]);
const CACHE_HOURS = 24;

export function classify({ total, delivered, returned }) {
  if (total === 0) return "new";
  if (returned >= 2 && returned >= delivered) return "bad";
  if (returned >= 1 && returned >= delivered) return "warn";
  if (returned >= 1) return "mixed";
  return delivered >= 1 ? "good" : "new";
}

// History of this phone number across every parcel in the ZR Express account.
async function fromZr(env, phone) {
  const result = await zrRequest(env, "/parcels/search", {
    method: "POST",
    body: {
      advancedFilter: { field: "customer.phone.number1", operator: "eq", value: toInternationalPhone(phone) },
      pageNumber: 1,
      pageSize: 1000,
    },
  });
  let delivered = 0;
  let returned = 0;
  const items = result?.items || [];
  for (const parcel of items) {
    if (parcel.isReturn) returned += 1;
    else if (DELIVERED.has(parcel.state?.name)) delivered += 1;
  }
  return { total: items.length, delivered, returned };
}

export async function riskFor(env, phone, { excludeOrderId = 0 } = {}) {
  const cached = await env.DB.prepare("SELECT total, delivered, returned, checked_at FROM customer_risk WHERE phone = ?")
    .bind(phone)
    .first();
  let history = null;
  if (cached) {
    const ageHours = (Date.now() - new Date(cached.checked_at).getTime()) / 3600000;
    if (ageHours < CACHE_HOURS) history = { total: cached.total, delivered: cached.delivered, returned: cached.returned };
  }
  if (!history) {
    history = await fromZr(env, phone);
    await env.DB.prepare(
      `INSERT INTO customer_risk (phone, total, delivered, returned, checked_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET total = excluded.total, delivered = excluded.delivered,
         returned = excluded.returned, checked_at = excluded.checked_at`,
    )
      .bind(phone, history.total, history.delivered, history.returned, new Date().toISOString())
      .run();
  }

  // Our own store: earlier orders from this number, and any that the manager cancelled or could not reach.
  const own = await env.DB.prepare(
    `SELECT count(*) AS orders,
            sum(CASE WHEN status = 'ملغى' THEN 1 ELSE 0 END) AS cancelled,
            sum(CASE WHEN status IN ('لم يرد 1', 'لم يرد 2', 'غير مجاب') THEN 1 ELSE 0 END) AS noAnswer
     FROM orders WHERE phone = ? AND id != ?`,
  )
    .bind(phone, excludeOrderId)
    .first();

  return {
    ...history,
    level: classify(history),
    others: Number(own?.orders || 0),
    cancelled: Number(own?.cancelled || 0),
    noAnswer: Number(own?.noAnswer || 0),
  };
}
