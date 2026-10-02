import {
  createAdminSession,
  json,
  sessionCookie,
} from "../../_shared/admin.js";

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

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "تعذر قراءة كلمة المرور." }, 400);
  }
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
