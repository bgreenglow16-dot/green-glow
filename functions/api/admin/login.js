import {
  createAdminSession,
  json,
  sessionCookie,
} from "../../_shared/admin.js";
import {
  clientIp,
  forbidCrossOrigin,
  rateLimited,
  readJsonBody,
  tooManyRequests,
} from "../../_shared/security.js";

const encoder = new TextEncoder();

async function passwordMatches(supplied, expected) {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: "إعدادات دخول الإدارة غير مكتملة." }, 503);
  }

  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  if (
    (await rateLimited(env, `login:${clientIp(request)}`, 5, 900)) ||
    (await rateLimited(env, "login:all", 40, 900))
  ) {
    return tooManyRequests("محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة.");
  }

  const parsed = await readJsonBody(request, 2000);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "بيانات تسجيل الدخول غير صحيحة." }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length > 256 || !(await passwordMatches(password, env.ADMIN_PASSWORD))) {
    return json({ error: "كلمة المرور غير صحيحة." }, 401);
  }

  const cookie = await createAdminSession(env);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(cookie) });
}
