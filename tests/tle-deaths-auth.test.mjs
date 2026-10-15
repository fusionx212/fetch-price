import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { OWNER, STRANGER, installStub, bearer } from "./_harness.mjs";

const BASE = "https://fetch-price.com/api/tle/deaths";
let restore, handler, mintAccessToken;

before(async () => {
  restore = installStub();
  ({ default: handler } = await import("../netlify/functions/tle-deaths.mjs"));
  ({ mintAccessToken } = await import("../netlify/functions/_shared/access-gate.mjs"));
});
after(() => restore());

const get = (qs, headers = {}) => handler(new Request(`${BASE}${qs}`, { headers }));

test("refuses a bare ?email= of a vulture subscriber", async () => {
  const res = await get(`?email=${encodeURIComponent(OWNER)}`);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).deaths, undefined);
});

test("a stranger's token plus ?email=owner gets no distress data", async () => {
  const res = await get(`?email=${encodeURIComponent(OWNER)}`, bearer(mintAccessToken(STRANGER)));
  assert.equal(res.status, 402);
  assert.equal((await res.json()).deaths, undefined);
});

test("the subscriber gets their distress signals via Bearer", async () => {
  const res = await get("", bearer(mintAccessToken(OWNER)));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deaths[0].company_name, "Paid Distress Ltd");
});
