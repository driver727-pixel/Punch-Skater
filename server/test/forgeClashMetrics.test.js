import assert from "node:assert/strict";
import test from "node:test";

import { getCardRarityBonus, toFiniteNumber } from "../../src/lib/forgeClashMetrics.ts";

test("toFiniteNumber falls back for non-finite metric inputs", () => {
  assert.equal(toFiniteNumber(null), 0);
  assert.equal(toFiniteNumber(undefined), 0);
  assert.equal(toFiniteNumber(""), 0);
  assert.equal(toFiniteNumber(Number.NaN), 0);
  assert.equal(toFiniteNumber(Number.POSITIVE_INFINITY), 0);
  assert.equal(toFiniteNumber({}, 7), 7);
});

test("toFiniteNumber accepts finite numbers and numeric strings", () => {
  assert.equal(toFiniteNumber(12), 12);
  assert.equal(toFiniteNumber("14.5"), 14.5);
});

test("getCardRarityBonus handles missing and non-finite rarity values", () => {
  assert.equal(getCardRarityBonus({ prompts: { rarity: "Legendary" } }), 11);
  assert.equal(getCardRarityBonus({ prompts: { rarity: "Prototype" } }), 0);
  assert.equal(
    getCardRarityBonus(
      { prompts: { rarity: "Legendary" } },
      { Legendary: Number.NaN },
    ),
    0,
  );
});
