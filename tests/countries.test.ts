import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COUNTRIES, COUNTRY_BY_CODE } from "../app/data/countries.ts";

const flagsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "flags",
);

test("there are exactly 194 recognized countries", () => {
  assert.equal(COUNTRIES.length, 194);
});

test("every country code is unique and lowercase two letters", () => {
  const seen = new Set<string>();
  for (const c of COUNTRIES) {
    assert.match(c.code, /^[a-z]{2}$/, `bad code: ${c.code}`);
    assert.ok(!seen.has(c.code), `duplicate code: ${c.code}`);
    seen.add(c.code);
  }
});

test("every country has a non-empty name and a valid hue", () => {
  for (const c of COUNTRIES) {
    assert.ok(c.name.length > 0, `empty name: ${c.code}`);
    assert.ok(c.hue >= 0 && c.hue < 360, `bad hue: ${c.code}`);
  }
});

test("COUNTRY_BY_CODE resolves every country", () => {
  for (const c of COUNTRIES) {
    assert.equal(COUNTRY_BY_CODE[c.code], c);
  }
});

test("every country ships a self-hosted flag PNG", () => {
  const files = new Set(readdirSync(flagsDir));
  for (const c of COUNTRIES) {
    assert.ok(files.has(`${c.code}.png`), `missing flag: ${c.code}.png`);
  }
});
