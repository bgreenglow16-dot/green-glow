const encoder = new TextEncoder();
const cookieName = "gg_admin";
const sessionSeconds = 8 * 60 * 60;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

async function sign(expiry, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(expiry));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function createAdminSession(env) {
  const expiry = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  return `${expiry}.${await sign(expiry, env.SESSION_SECRET)}`;
}

export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return false;

  const cookie = request.headers.get("Cookie") || "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!value) return false;

  const [expiry, signature] = value.split(".");
  if (
    !expiry ||
    !signature ||
    !Number.isFinite(Number(expiry)) ||
    Number(expiry) <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  return signature === (await sign(expiry, env.SESSION_SECRET));
}

export async function requireAdmin(request, env) {
  if (!(await isAdmin(request, env))) {
    return json({ error: "يلزم تسجيل الدخول للمتابعة." }, 401);
  }
  return null;
}

export function sessionCookie(value) {
  return `${cookieName}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionSeconds}`;
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
