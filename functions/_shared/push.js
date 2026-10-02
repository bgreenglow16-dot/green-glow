// Web Push (RFC 8030) with aes128gcm payload encryption (RFC 8291) and VAPID (RFC 8292), on WebCrypto only.
const encoder = new TextEncoder();

export function fromBase64Url(value) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

// `senderKeys` and `salt` are injectable only so the RFC's published test vector can be checked.
export async function encryptPayload(payload, p256dh, auth, { senderKeys, salt } = {}) {
  const receiverPublic = fromBase64Url(p256dh);
  const authSecret = fromBase64Url(auth);
  const keys = senderKeys || (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const receiverKey = await crypto.subtle.importKey("raw", receiverPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, keys.privateKey, 256));

  const prkKey = await hmac(authSecret, shared);
  const keyInfo = concat(encoder.encode("WebPush: info\0"), receiverPublic, senderPublic);
  const ikm = (await hmac(prkKey, concat(keyInfo, Uint8Array.of(1)))).slice(0, 32);

  const saltBytes = salt || crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(saltBytes, ikm);
  const contentKey = (await hmac(prk, concat(encoder.encode("Content-Encoding: aes128gcm\0"), Uint8Array.of(1)))).slice(0, 16);
  const nonce = (await hmac(prk, concat(encoder.encode("Content-Encoding: nonce\0"), Uint8Array.of(1)))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, Uint8Array.of(2))),
  );

  const header = new Uint8Array(21);
  header.set(saltBytes, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, ciphertext);
}

async function vapidAuthorization(env, endpoint) {
  const key = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(env.VAPID_PRIVATE_KEY),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT || "https://green-glow-67m.pages.dev",
      }),
    ),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${claims}`)),
  );
  return `vapid t=${header}.${claims}.${toBase64Url(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export function pushConfigured(env) {
  return Boolean(env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY && env.DB);
}

async function sendOne(env, subscription, message) {
  const body = await encryptPayload(encoder.encode(JSON.stringify(message)), subscription.p256dh, subscription.auth);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(env, subscription.endpoint),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
  return response.status;
}

// Sends to every enrolled device and forgets the ones the push service says are gone.
export async function notifyAll(env, message) {
  if (!pushConfigured(env)) return { sent: 0, removed: 0 };
  const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions LIMIT 20").all();
  let sent = 0;
  let removed = 0;
  await Promise.all(
    results.map(async (subscription) => {
      try {
        const status = await sendOne(env, subscription, message);
        if (status === 404 || status === 410) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(subscription.endpoint).run();
          removed += 1;
        } else if (status >= 200 && status < 300) {
          sent += 1;
        } else {
          console.error("Push service answered", status);
        }
      } catch (error) {
        console.error("Push delivery failed:", error?.message);
      }
    }),
  );
  return { sent, removed };
}
