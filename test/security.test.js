import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost as createOrder } from "../functions/api/orders.js";
import { onRequestPost as login } from "../functions/api/admin/login.js";
import { crossOriginBlocked, rateLimited } from "../functions/_shared/security.js";

function counterDb() {
  const counts = new Map();
  const inserted = [];
  return {
    inserted,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              const key = `${values[0]}:${values[1]}`;
              counts.set(key, (counts.get(key) || 0) + 1);
              return { count: counts.get(key) };
            },
            async run() {
              if (/INSERT INTO orders/.test(query)) inserted.push(values);
              return { meta: { last_row_id: 5, changes: 1 } };
            },
          };
        },
      };
    },
  };
}

const orderBody = {
  customerName: "أحمد محمد",
  phone: "0551234567",
  wilaya: "الجزائر",
  municipality: "باب الوادي",
  address: "شارع المثال",
  deliveryType: "home",
  items: [{ id: "oil", quantity: 1 }],
};

const post = (url, body, headers = {}) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("cross-site requests are rejected", async () => {
  assert.equal(crossOriginBlocked(post("https://site.dev/api/orders", {}, { Origin: "https://evil.example" })), true);
  assert.equal(crossOriginBlocked(post("https://site.dev/api/orders", {}, { Origin: "https://site.dev" })), false);
  assert.equal(crossOriginBlocked(post("https://site.dev/api/orders", {})), false);

  const DB = counterDb();
  const response = await createOrder({
    request: post("https://site.dev/api/orders", orderBody, { Origin: "https://evil.example" }),
    env: { DB },
    waitUntil() {},
  });
  assert.equal(response.status, 403);
  assert.equal(DB.inserted.length, 0);
});

test("honeypot submissions are silently dropped", async () => {
  const DB = counterDb();
  const response = await createOrder({
    request: post("https://site.dev/api/orders", { ...orderBody, website: "http://spam.example" }),
    env: { DB },
    waitUntil() {},
  });
  assert.equal(response.status, 200);
  assert.equal(DB.inserted.length, 0);
});

test("the same phone number is limited to three orders per hour", async () => {
  const DB = counterDb();
  const statuses = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await createOrder({
      request: post("https://site.dev/api/orders", orderBody, { "CF-Connecting-IP": `10.0.0.${attempt}` }),
      env: { DB },
      waitUntil() {},
    });
    statuses.push(response.status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  assert.equal(DB.inserted.length, 3);
});

test("login attempts are limited per address", async () => {
  const DB = counterDb();
  const env = { DB, ADMIN_PASSWORD: "correct horse", SESSION_SECRET: "secret" };
  const statuses = [];
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await login({
      request: post("https://site.dev/api/admin/login", { password: "wrong" }, { "CF-Connecting-IP": "1.2.3.4" }),
      env,
    });
    statuses.push(response.status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429, 429]);
});

test("a failing rate-limit store never blocks customers", async () => {
  const brokenDb = {
    prepare() {
      throw new Error("db down");
    },
  };
  assert.equal(await rateLimited({ DB: brokenDb }, "k", 1, 60), false);
});
