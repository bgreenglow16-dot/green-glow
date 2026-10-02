import assert from "node:assert/strict";
import test from "node:test";
import { encryptPayload, fromBase64Url, toBase64Url } from "../functions/_shared/push.js";

// RFC 8291 appendix A inputs.
const vector = {
  plaintext: "When I grow up, I want to be a watermelon",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  senderPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  receiverPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  authSecret: "BTBZMqHGlPEjSE2gRjKFoQ",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  // Output of the reference implementation (npm http_ece, used by web-push) for the RFC 8291 inputs above.
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_VK74grVnve0jlzoEohq1fTHok7T01JVhxbWRGX_uRxkvSsxMONp-t_6Nb9dgPrJ8Wp7NApLxzdVGK",
};

test("web push encryption matches the reference implementation on the RFC 8291 inputs", async () => {
  const publicBytes = fromBase64Url(vector.senderPublic);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: vector.senderPrivate,
    x: toBase64Url(publicBytes.slice(1, 33)),
    y: toBase64Url(publicBytes.slice(33, 65)),
  };
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const { d, ...publicJwk } = jwk;
  const publicKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, true, []);

  const body = await encryptPayload(
    new TextEncoder().encode(vector.plaintext),
    vector.receiverPublic,
    vector.authSecret,
    { senderKeys: { privateKey, publicKey }, salt: fromBase64Url(vector.salt) },
  );
  assert.equal(toBase64Url(body), vector.body);
});

test("a fresh encryption has the aes128gcm record layout", async () => {
  const receiver = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const receiverPublic = toBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", receiver.publicKey)));
  const body = await encryptPayload(new TextEncoder().encode("hello"), receiverPublic, toBase64Url(crypto.getRandomValues(new Uint8Array(16))));
  assert.equal(new DataView(body.buffer).getUint32(16), 4096);
  assert.equal(body[20], 65);
  // salt(16) + rs(4) + idlen(1) + key(65) + ciphertext(payload + delimiter + 16 byte tag)
  assert.equal(body.length, 16 + 4 + 1 + 65 + ("hello".length + 1 + 16));
});

test("notifyAll signs with VAPID, delivers, and forgets expired devices", async () => {
  const { notifyAll } = await import("../functions/_shared/push.js");
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const vapidPublic = toBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", vapid.publicKey)));
  const vapidPrivate = JSON.stringify(await crypto.subtle.exportKey("jwk", vapid.privateKey));

  const makeSubscription = async (endpoint) => {
    const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    return {
      endpoint,
      p256dh: toBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey))),
      auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
    };
  };
  const subscriptions = [await makeSubscription("https://push.example/ok"), await makeSubscription("https://push.example/gone")];
  const deleted = [];
  const env = {
    VAPID_PUBLIC_KEY: vapidPublic,
    VAPID_PRIVATE_KEY: vapidPrivate,
    DB: {
      prepare(query) {
        return {
          async all() {
            return { results: subscriptions };
          },
          bind(value) {
            return {
              async run() {
                if (/DELETE FROM push_subscriptions/.test(query)) deleted.push(value);
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };

  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    seen.push({ url: String(url), headers: options.headers, size: options.body.length });
    return new Response(null, { status: String(url).endsWith("/gone") ? 410 : 201 });
  };
  try {
    const result = await notifyAll(env, { title: "طلب جديد #1", body: "x", url: "/admin/" });
    assert.deepEqual(result, { sent: 1, removed: 1 });
    assert.deepEqual(deleted, ["https://push.example/gone"]);
    const first = seen.find((item) => item.url.endsWith("/ok"));
    assert.match(first.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    assert.equal(first.headers["Content-Encoding"], "aes128gcm");
    assert.ok(first.size > 100);
  } finally {
    globalThis.fetch = realFetch;
  }

  const unconfigured = await notifyAll({ DB: env.DB }, { title: "x" });
  assert.deepEqual(unconfigured, { sent: 0, removed: 0 });
});
