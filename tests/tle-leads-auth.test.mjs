import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { OWNER, STRANGER, installStub, bearer, rcdLegacyToken, otherAudienceToken } from "./_harness.mjs";

const BASE = "https://fetch-price.com/api/tle/leads";
let restore, handler, mintAccessToken;

before(async () => {
  restore = installStub();
  ({ default: handler } = await import("../netlify/functions/tle-leads.mjs"));
  ({ mintAccessToken } = await import("../netlify/functions/_shared/access-gate.mjs"));
});
after(() => restore());

const get = (qs, headers = {}) => handler(new Request(`${BASE}${qs}`, { headers }));

test("refuses a bare ?email= of a paying customer (SEC-01)", async () => {
  const res = await get(`?email=${encodeURIComponent(OWNER)}`);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).leads, undefined);
});

test("refuses a request with no credential", async () => {
  assert.equal((await get("")).status, 401);
});

test("refuses a valid token passed in the query string (log/Referer leak)", async () => {
  const res = await get(`?token=${encodeURIComponent(mintAccessToken(OWNER))}`);
  assert.equal(res.status, 401);
});

test("refuses a forged / tampered token", async () => {
  const [aud, , exp, sig] = mintAccessToken(STRANGER).split(".");
  const forged = `${aud}.${Buffer.from(OWNER).toString("base64url")}.${exp}.${sig}`;
  assert.equal((await get("", bearer(forged))).status, 401);
});

test("refuses an expired token", async () => {
  assert.equal((await get("", bearer(mintAccessToken(OWNER, -1)))).status, 401);
});

test("refuses an RCD-format token signed with the shared secret (cross-site replay)", async () => {
  assert.equal((await get("", bearer(rcdLegacyToken(OWNER)))).status, 401);
});

test("refuses an audience-bound token minted for another site", async () => {
  assert.equal((await get("", bearer(otherAudienceToken(OWNER)))).status, 401);
});

test("a valid token for someone else plus ?email=owner never returns the owner's leads", async () => {
  const res = await get(`?email=${encodeURIComponent(OWNER)}`, bearer(mintAccessToken(STRANGER)));
  assert.notEqual(res.status, 200);
  const body = await res.json();
  assert.equal(body.leads, undefined);
  assert.notEqual(body.email, OWNER);
});

test("the rightful owner gets their leads via Authorization: Bearer", async () => {
  const res = await get("", bearer(mintAccessToken(OWNER)));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.email, OWNER);
  assert.equal(body.leads.length, 1);
  assert.equal(body.leads[0].company_name, "Owner Paid Ltd");
});
