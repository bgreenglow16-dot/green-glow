const API = "https://api.zrexpress.app/api/v1";

// Same order as the wilaya dropdown on the storefront: index + 1 is the official wilaya code.
export const WILAYAS =
  "أدرار،الشلف،الأغواط،أم البواقي،باتنة،بجاية،بسكرة،بشار،البليدة،البويرة،تمنراست،تبسة،تلمسان،تيارت،تيزي وزو،الجزائر،الجلفة،جيجل،سطيف،سعيدة،سكيكدة،سيدي بلعباس،عنابة،قالمة،قسنطينة،المدية،مستغانم،المسيلة،معسكر،ورقلة،وهران،البيض،إليزي،برج بوعريريج،بومرداس،الطارف،تندوف،تيسمسيلت،الوادي،خنشلة،سوق أهراس،تيبازة،ميلة،عين الدفلى،النعامة،عين تموشنت،غرداية،غليزان،تيميمون،برج باجي مختار،أولاد جلال،بني عباس،عين صالح،عين قزام،تقرت،جانت،المغير،المنيعة".split(
    "،",
  );

export class ZrError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, "");
}

export async function zrRequest(env, path, { method = "GET", body } = {}) {
  if (!env.ZR_API_KEY || !env.ZR_TENANT_ID) {
    throw new ZrError("مفاتيح ZR Express غير مضبوطة.", 503);
  }
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "X-Api-Key": env.ZR_API_KEY,
      "X-Tenant": env.ZR_TENANT_ID,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    const source = data?.errors ?? data?.detail ?? data?.message ?? data?.title;
    const detail = source ? JSON.stringify(source).slice(0, 300) : `HTTP ${response.status}`;
    console.error("ZR Express request failed:", method, path, response.status, text.slice(0, 500));
    const failure = new ZrError(`رفضت ZR Express الطلب: ${detail}`, 502);
    failure.upstream = response.status;
    throw failure;
  }
  return data;
}

async function searchAll(env, path, extra = {}) {
  const items = [];
  for (let page = 1; page <= 5; page += 1) {
    const result = await zrRequest(env, path, {
      method: "POST",
      body: { pageNumber: page, pageSize: 1000, ...extra },
    });
    items.push(...(result?.items || []));
    if (!result?.hasNext) break;
  }
  return items;
}

export async function loadTerritories(env) {
  return searchAll(env, "/territories/search", { orderBy: ["code asc"] });
}

export async function loadPickupHubs(env) {
  return searchAll(env, "/hubs/search", {
    advancedFilter: { field: "isPickupPoint", operator: "eq", value: true },
  });
}

export function findWilaya(territories, wilayaName) {
  const wanted = normalize(wilayaName);
  let wilaya = territories.find(
    (item) => item.level === "wilaya" && normalize(item.nameArabic) === wanted,
  );
  if (!wilaya) {
    const index = WILAYAS.findIndex((name) => normalize(name) === wanted);
    if (index === -1) throw new ZrError(`الولاية غير معروفة: ${wilayaName}`, 422);
    wilaya = territories.find((item) => item.level === "wilaya" && item.code === index + 1);
  }
  if (!wilaya) throw new ZrError(`ZR Express لا تخدم ولاية ${wilayaName}.`, 422);
  if (wilaya.delivery?.canSend === false) {
    throw new ZrError(`ZR Express لا ترسل حاليا إلى ولاية ${wilayaName}.`, 422);
  }
  return wilaya;
}

export function communesOf(territories, wilaya) {
  return territories.filter((item) => item.level === "commune" && item.parentId === wilaya.id);
}

export function matchCommune(communes, municipality) {
  const wanted = normalize(municipality);
  if (!wanted) return null;
  const exact = communes.filter(
    (item) => normalize(item.name) === wanted || normalize(item.nameArabic) === wanted,
  );
  if (exact.length === 1) return exact[0];
  const loose = communes.filter((item) => {
    const names = [normalize(item.name), normalize(item.nameArabic)].filter(Boolean);
    return names.some((name) => name.includes(wanted) || wanted.includes(name));
  });
  return loose.length === 1 ? loose[0] : null;
}

export function toInternationalPhone(phone) {
  return `+213${String(phone).replace(/^0/, "")}`;
}

const LOCATIONS_TTL_MS = 10 * 60 * 1000;
let locationsCache = { at: 0, value: null };

// Served wilayas with their communes and ZR delivery prices (commune price, else wilaya price).
export async function getLocations(env) {
  if (locationsCache.value && Date.now() - locationsCache.at < LOCATIONS_TTL_MS) {
    return locationsCache.value;
  }
  const [territories, ratesResponse] = await Promise.all([
    loadTerritories(env),
    zrRequest(env, "/delivery-pricing/rates"),
  ]);

  const rateByTerritory = new Map();
  for (const rate of ratesResponse?.rates || []) {
    const prices = {};
    for (const price of rate.deliveryPrices || []) {
      prices[price.deliveryType] = price.discountedPrice ?? price.price;
    }
    rateByTerritory.set(rate.toTerritoryId, {
      home: prices.home > 0 ? prices.home : null,
      desk: prices["pickup-point"] > 0 ? prices["pickup-point"] : null,
    });
  }

  const wilayas = territories
    .filter((item) => item.level === "wilaya" && item.delivery?.canSend !== false)
    .sort((a, b) => a.code - b.code)
    .map((wilaya) => ({
      id: wilaya.id,
      code: wilaya.code,
      name: wilaya.name,
      nameArabic: wilaya.nameArabic || wilaya.name,
      rates: rateByTerritory.get(wilaya.id) || null,
      communes: communesOf(territories, wilaya)
        .sort((a, b) => (a.nameArabic || a.name).localeCompare(b.nameArabic || b.name, "ar"))
        .map((commune) => ({
          id: commune.id,
          name: commune.name,
          nameArabic: commune.nameArabic || commune.name,
          home: commune.delivery?.hasHomeDelivery !== false,
          desk: commune.delivery?.hasPickupPoint !== false,
          rates: rateByTerritory.get(commune.id) || null,
        })),
    }));

  if (!wilayas.length) throw new ZrError("تعذر تحميل ولايات ZR Express.", 502);
  const value = { wilayas };
  locationsCache = { at: Date.now(), value };
  return value;
}

export function deliveryPriceFor(wilaya, commune, type) {
  const key = type === "home" ? "home" : "desk";
  return commune?.rates?.[key] ?? wilaya?.rates?.[key] ?? null;
}

// States after which nothing more will happen to a parcel, so we stop polling it.
const FINAL_STATES = new Set(["livre", "encaisse", "recouvert", "recupere_par_fournisseur", "missing"]);

export function isFinalState(name) {
  return FINAL_STATES.has(name) || /annul|cancel/i.test(name || "");
}

export async function findParcel(env, trackingNumber) {
  try {
    return await zrRequest(env, `/parcels/${encodeURIComponent(trackingNumber)}`);
  } catch (error) {
    if (error instanceof ZrError && error.upstream === 404) return null;
    throw error;
  }
}

export function shippingColumns(parcel) {
  if (!parcel) {
    return { state: "missing", desc: "Colis introuvable chez ZR Express", color: "66756a" };
  }
  const state = parcel.state || {};
  return {
    state: String(state.name || ""),
    desc: String(state.description || ""),
    color: String(state.color || "").replace(/[^0-9a-fA-F]/g, "").slice(0, 6),
  };
}

export async function saveShipping(env, orderId, parcel) {
  const columns = shippingColumns(parcel);
  await env.DB.prepare(
    "UPDATE orders SET shipping_state = ?, shipping_desc = ?, shipping_color = ?, shipping_checked_at = ? WHERE id = ?",
  )
    .bind(columns.state, columns.desc, columns.color, new Date().toISOString(), orderId)
    .run();
  return columns;
}
