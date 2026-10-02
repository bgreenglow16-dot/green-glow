import assert from "node:assert/strict";
import test from "node:test";
import {
  WILAYAS,
  communesOf,
  findWilaya,
  matchCommune,
  normalize,
  toInternationalPhone,
} from "../functions/_shared/zr.js";

const territories = [
  { id: "w16", level: "wilaya", code: 16, name: "Alger", nameArabic: "الجزائر", delivery: { canSend: true } },
  { id: "w1", level: "wilaya", code: 1, name: "Adrar", nameArabic: "أدرار", delivery: { canSend: false } },
  { id: "c1", level: "commune", parentId: "w16", name: "Bab Ezzouar", nameArabic: "باب الزوار" },
  { id: "c2", level: "commune", parentId: "w16", name: "Bab El Oued", nameArabic: "باب الوادي" },
  { id: "c3", level: "commune", parentId: "w16", name: "Alger Centre", nameArabic: "الجزائر الوسطى" },
];

test("wilaya list matches the official numbering", () => {
  assert.equal(WILAYAS.length, 58);
  assert.equal(WILAYAS[15], "الجزائر");
});

test("wilayas resolve by code and unserved ones are refused", () => {
  assert.equal(findWilaya(territories, "الجزائر").id, "w16");
  assert.throws(() => findWilaya(territories, "أدرار"), /لا ترسل/);
  assert.throws(() => findWilaya(territories, "غير معروفة"), /غير معروفة/);
});

test("communes match Arabic and Latin names, and ambiguity returns null", () => {
  const communes = communesOf(territories, territories[0]);
  assert.equal(communes.length, 3);
  assert.equal(matchCommune(communes, "باب الزوار")?.id, "c1");
  assert.equal(matchCommune(communes, "bab ezzouar")?.id, "c1");
  assert.equal(matchCommune(communes, "Bab-Ez-Zouar")?.id, "c1");
  assert.equal(matchCommune(communes, "باب"), null);
  assert.equal(matchCommune(communes, "مكان غير موجود"), null);
});

test("helpers normalise text and phone numbers", () => {
  assert.equal(normalize("الجزائرة"), normalize("الجزائره"));
  assert.equal(toInternationalPhone("0551234567"), "+213551234567");
});

test("order delivery price comes from ZR rates and unserved wilayas are refused", async () => {
  const { onRequestPost: createOrder } = await import("../functions/api/orders.js");
  const zrTerritories = {
    items: [
      { id: "w31", level: "wilaya", code: 31, name: "Oran", nameArabic: "وهران", delivery: { canSend: true } },
      { id: "w1", level: "wilaya", code: 1, name: "Adrar", nameArabic: "أدرار", delivery: { canSend: false } },
      { id: "o1", level: "commune", parentId: "w31", name: "Es Senia", nameArabic: "السانية", delivery: { hasHomeDelivery: true, hasPickupPoint: false } },
      { id: "o2", level: "commune", parentId: "w31", name: "Bir El Djir", nameArabic: "بئر الجير", delivery: { hasHomeDelivery: true, hasPickupPoint: true } },
    ],
    hasNext: false,
  };
  const zrRates = {
    rates: [
      { toTerritoryId: "w31", deliveryPrices: [{ deliveryType: "home", price: 700 }, { deliveryType: "pickup-point", price: 450 }] },
      { toTerritoryId: "o2", deliveryPrices: [{ deliveryType: "home", price: 650 }, { deliveryType: "pickup-point", price: 400 }] },
    ],
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response(JSON.stringify(String(url).includes("delivery-pricing") ? zrRates : zrTerritories), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const place = async (overrides) => {
      const calls = [];
      const DB = {
        prepare: () => ({
          bind: (...values) => ({
            run: async () => {
              calls.push(values);
              return { meta: { last_row_id: 7, changes: 1 } };
            },
          }),
        }),
      };
      const response = await createOrder({
        request: new Request("https://green-glow.pages.dev/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerName: "أحمد محمد",
            phone: "0551234567",
            wilaya: "وهران",
            municipality: "بئر الجير",
            address: "شارع المثال",
            deliveryType: "home",
            items: [{ id: "laban", quantity: 1 }],
            ...overrides,
          }),
        }),
        env: { DB, ZR_API_KEY: "k", ZR_TENANT_ID: "t" },
        waitUntil() {},
      });
      return { status: response.status, total: calls[0]?.[9], body: await response.json() };
    };

    assert.equal((await place({})).total, 2500 + 650);
    assert.equal((await place({ deliveryType: "desk" })).total, 2500 + 400);
    // A commune without its own rate falls back to the wilaya rate.
    assert.equal((await place({ municipality: "السانية" })).total, 2500 + 700);
    // No pickup point in that commune.
    assert.equal((await place({ municipality: "السانية", deliveryType: "desk", address: "" })).status, 400);
    assert.equal((await place({ wilaya: "أدرار", municipality: "أدرار" })).status, 400);
    assert.equal((await place({ municipality: "بلدية وهمية" })).status, 400);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("shipment states: final detection and column mapping", async () => {
  const { isFinalState, shippingColumns } = await import("../functions/_shared/zr.js");
  for (const name of ["livre", "encaisse", "recouvert", "recupere_par_fournisseur", "missing", "colis_annule"]) {
    assert.equal(isFinalState(name), true, name);
  }
  for (const name of ["", "commande_recue", "vers_wilaya", "sortie_en_livraison"]) {
    assert.equal(isFinalState(name), false, name);
  }
  assert.deepEqual(
    shippingColumns({ state: { name: "livre", description: "Livré", color: "#388e3c" } }),
    { state: "livre", desc: "Livré", color: "388e3c" },
  );
  assert.equal(shippingColumns(null).state, "missing");
});
