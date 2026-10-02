import { json } from "../_shared/admin.js";
import { ZrError, getLocations } from "../_shared/zr.js";

export async function onRequestGet({ env, request }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/locations", request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  try {
    const { wilayas } = await getLocations(env);
    const response = json({ wilayas }, 200, { "cache-control": "public, max-age=600" });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    if (!(error instanceof ZrError)) console.error("Locations failed:", error);
    return json({ error: "تعذر تحميل قائمة الولايات." }, 502, { "cache-control": "no-store" });
  }
}
