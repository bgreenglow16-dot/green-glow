import { json, requireAdmin } from "../../_shared/admin.js";
import { forbidCrossOrigin, readJsonBody } from "../../_shared/security.js";
import { notifyAll, pushConfigured } from "../../_shared/push.js";

// GET: the public key a browser needs to subscribe, and how many devices are enrolled.
export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!pushConfigured(env)) return json({ enabled: false });
  const row = await env.DB.prepare("SELECT count(*) AS n FROM push_subscriptions").first();
  return json({ enabled: true, publicKey: env.VAPID_PUBLIC_KEY, devices: Number(row?.n || 0) });
}

// POST: enrol this browser. { endpoint, keys: { p256dh, auth } } is what PushSubscription.toJSON() returns.
export async function onRequestPost({ request, env }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!pushConfigured(env)) return json({ error: "الإشعارات غير مهيأة على الخادم." }, 503);

  const parsed = await readJsonBody(request, 4000);
  if (parsed.error) return parsed.error;

  if (parsed.body?.test === true) {
    const result = await notifyAll(env, {
      title: "إشعار تجريبي ✅",
      body: "الإشعارات تعمل على هذا الجهاز.",
      url: "/admin/",
      tag: "test",
    });
    return json({ ok: true, ...result });
  }

  const { endpoint, keys } = parsed.body || {};
  const validEndpoint = typeof endpoint === "string" && endpoint.length < 1000 && /^https:\/\//.test(endpoint);
  if (!validEndpoint || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
    return json({ error: "بيانات الاشتراك غير صحيحة." }, 400);
  }
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
  )
    .bind(endpoint, keys.p256dh, keys.auth)
    .run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const parsed = await readJsonBody(request, 2000);
  if (parsed.error) return parsed.error;
  if (typeof parsed.body?.endpoint === "string") {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(parsed.body.endpoint).run();
  }
  return json({ ok: true });
}
