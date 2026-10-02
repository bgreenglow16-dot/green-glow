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
