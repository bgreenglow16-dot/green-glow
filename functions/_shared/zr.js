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
    throw new ZrError(`رفضت ZR Express الطلب: ${detail}`, 502);
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
  const index = WILAYAS.findIndex((name) => normalize(name) === normalize(wilayaName));
  if (index === -1) throw new ZrError(`الولاية غير معروفة: ${wilayaName}`, 422);
  const code = index + 1;
  const wilaya = territories.find((item) => item.level === "wilaya" && item.code === code);
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
