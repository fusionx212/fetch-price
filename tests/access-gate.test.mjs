import { test } from "node:test";
import assert from "node:assert/strict";
import { OWNER, SECRET } from "./_harness.mjs";

process.env.RCD_TOKEN_SECRET = SECRET;
const { mintAccessToken, verifyAccessToken, TOKEN_AUDIENCE } = await import("../netlify/functions/_shared/access-gate.mjs");

test("tokens carry the fetch-price.com audience", () => {
  const [aud] = mintAccessToken(OWNER).split(".");
  assert.equal(TOKEN_AUDIENCE, "fetch-price.com");
  assert.equal(Buffer.from(aud, "base64url").toString(), TOKEN_AUDIENCE);
});

test("signing key never falls back to CRON_SECRET / PIPELINE_SECRET (cron bearer)", () => {
  const token = mintAccessToken(OWNER);
  delete process.env.RCD_TOKEN_SECRET;
  process.env.CRON_SECRET = SECRET;
  process.env.PIPELINE_SECRET = SECRET;
  try {
    assert.throws(() => verifyAccessToken(token), /RCD_TOKEN_SECRET not configured/);
    assert.throws(() => mintAccessToken(OWNER), /RCD_TOKEN_SECRET not configured/);
  } finally {
    process.env.RCD_TOKEN_SECRET = SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.PIPELINE_SECRET;
  }
});

test("round-trips for the owner", () => {
  assert.equal(verifyAccessToken(mintAccessToken(OWNER)), OWNER);
});
