import { json } from "../_shared/admin.js";
import { ZrError, getLocations } from "../_shared/zr.js";

export async function onRequestGet({ env }) {
  try {
    const { wilayas } = await getLocations(env);
    return json({ wilayas }, 200, { "cache-control": "public, max-age=600" });
  } catch (error) {
    if (!(error instanceof ZrError)) console.error("Locations failed:", error);
    return json({ error: "تعذر تحميل قائمة الولايات." }, 502, { "cache-control": "no-store" });
  }
}
