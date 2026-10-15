import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { OWNER, installStub, bearer } from "./_harness.mjs";

const BASE = "https://fetch-price.com/api/tle/intel";
let restore, handler, mintAccessToken;

before(async () => {
  restore = installStub();
  ({ default: handler } = await import("../netlify/functions/tle-intel.mjs"));
  ({ mintAccessToken } = await import("../netlify/functions/_shared/access-gate.mjs"));
});
after(() => restore());

const get = (qs, headers = {}) => handler(new Request(`${BASE}${qs}`, { headers }));

test("?email= of a monitor subscriber gets aggregates only: no profile, no paid rows", async () => {
  const res = await get(`?email=${encodeURIComponent(OWNER)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tier, "free");
  assert.equal(body.companies, undefined);
  assert.equal(body.profile, undefined);
  assert.ok(Array.isArray(body.summary));
});

test("anonymous free tier still works", async () => {
  const body = await (await get("?region=west-midlands")).json();
  assert.equal(body.tier, "free");
  assert.equal(body.summary[0].industry, "construction");
});

test("the monitor subscriber gets paid rows via Bearer", async () => {
  const body = await (await get("", bearer(mintAccessToken(OWNER)))).json();
  assert.equal(body.tier, "monitor");
  assert.equal(body.companies[0].company_name, "Paid Monitor Row Ltd");
  assert.equal(body.profile.industry_slug, "construction");
});
