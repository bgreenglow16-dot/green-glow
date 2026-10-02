import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { onRequestPost as createOrder } from "../functions/api/orders.js";
import { onRequestPost as login } from "../functions/api/admin/login.js";
import { onRequestPatch as updateOrder } from "../functions/api/admin/orders/[id].js";
import { isAdmin } from "../functions/_shared/admin.js";

function createDatabaseStub(runResult = { meta: { last_row_id: 42, changes: 1 } }) {
  const calls = [];
  return {
    calls,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async run() {
              calls.push({ query, values });
              return runResult;
            },
          };
        },
      };
    },
  };
}

function validOrder(overrides = {}) {
  return {
    customerName: "أحمد محمد",
    phone: "0551234567",
    wilaya: "الجزائر",
    municipality: "باب الوادي",
    address: "شارع المثال",
    deliveryType: "home",
    items: [{ id: "oil", quantity: 2 }],
    ...overrides,
  };
}

test("order total and product details are calculated on the server", async () => {
  const DB = createDatabaseStub();
  const response = await createOrder({
    request: new Request("https://green-glow.pages.dev/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validOrder(), totalPrice: 1 }),
    }),
    env: { DB },
    waitUntil() {},
  });
  const responseBody = await response.json();
  const values = DB.calls[0].values;

  assert.equal(response.status, 200);
  assert.equal(responseBody.orderId, 42);
  assert.equal(values[1], "0551234567");
  assert.equal(values[6], "زيت ذكر الثوم (150 مل) × 2، قارورة صغيرة من زيت ذكر الثوم (هدية) × 1");
  assert.equal(values[7], 2);
  assert.equal(values[9], 5600);
  assert.match(DB.calls[0].query, /items_json/);
  assert.deepEqual(JSON.parse(values[8]).map((item) => item.id), ["oil", "gift"]);
});

test("invalid orders are rejected before a database write", async () => {
  const DB = createDatabaseStub();
  const response = await createOrder({
    request: new Request("https://green-glow.pages.dev/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validOrder({ items: [{ id: "unknown", quantity: 1 }] })),
    }),
    env: { DB },
    waitUntil() {
      assert.fail("No notification should be queued for invalid orders");
    },
  });

  assert.equal(response.status, 400);
  assert.equal(DB.calls.length, 0);
});

test("database schema defaults order status and tracking number", async () => {
  const database = new DatabaseSync(":memory:");
  const migration = await readFile(
    new URL("../migrations/0001_create_orders.sql", import.meta.url),
    "utf8",
  );
  database.exec(migration);
  database
    .prepare(
      `INSERT INTO orders
       (customer_name, phone, wilaya, municipality, delivery_type, product,
        quantity, items_json, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("أحمد محمد", "0551234567", "الجزائر", "باب الوادي", "منزل", "زيت", 1, "[]", 3100);
  const row = database.prepare("SELECT status, tracking_number FROM orders").get();

  assert.equal(row.status, "قيد التأكيد");
  assert.equal(row.tracking_number, "");
  database.close();
});

test("admin login creates a signed, HTTP-only session cookie", async () => {
  const env = { ADMIN_PASSWORD: "test-admin-password", SESSION_SECRET: "test-session-secret" };
  const response = await login({
    request: new Request("https://green-glow.pages.dev/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }),
    env,
  });
  const cookie = response.headers.get("set-cookie");

  assert.equal(response.status, 200);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.equal(
    await isAdmin(
      new Request("https://green-glow.pages.dev/api/admin/orders", {
        headers: { cookie: cookie.split(";")[0] },
      }),
      env,
    ),
    true,
  );

  const rejected = await login({
    request: new Request("https://green-glow.pages.dev/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    }),
    env,
  });
  assert.equal(rejected.status, 401);
});

test("admin can update order status and tracking number with a valid session", async () => {
  const env = {
    ADMIN_PASSWORD: "test-admin-password",
    SESSION_SECRET: "test-session-secret",
    DB: createDatabaseStub(),
  };
  const loginResponse = await login({
    request: new Request("https://green-glow.pages.dev/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }),
    env,
  });
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const response = await updateOrder({
    request: new Request("https://green-glow.pages.dev/api/admin/orders/42", {
      method: "PATCH",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "مؤكد", trackingNumber: "TRK-123" }),
    }),
    env,
    params: { id: "42" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(env.DB.calls[0].values, ["مؤكد", "TRK-123", 42]);
});
