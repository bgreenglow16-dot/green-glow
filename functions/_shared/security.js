import { json } from "./admin.js";

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

// Browsers always send Origin on cross-site POSTs; reject any that is not this site.
export function crossOriginBlocked(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

export function forbidCrossOrigin(request) {
  return crossOriginBlocked(request) ? json({ error: "طلب غير مسموح." }, 403) : null;
}

export async function readJsonBody(request, maxBytes = 20000) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { error: json({ error: "الطلب كبير جدا." }, 413) };
  const text = await request.text();
  if (text.length > maxBytes) return { error: json({ error: "الطلب كبير جدا." }, 413) };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: json({ error: "تعذر قراءة البيانات." }, 400) };
  }
}

// Fixed-window counter in D1. Fails open so a database hiccup never blocks real customers.
export async function rateLimited(env, key, limit, windowSeconds) {
  if (!env.DB) return false;
  try {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSeconds);
    const row = await env.DB.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
      .bind(key, windowStart)
      .first();
    if (Math.random() < 0.02) {
      await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?")
        .bind(now - 2 * 24 * 3600)
        .run();
    }
    return Number(row?.count) > limit;
  } catch (error) {
    console.error("Rate limit check failed:", error?.message);
    return false;
  }
}

export function tooManyRequests(message) {
  return json({ error: message }, 429, { "retry-after": "600" });
}
