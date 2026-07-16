/**
 * GET /api/tle/resolve — robots-safe public taps for a company row.
 * Query: company_number, name, sic (comma), website, verify=1
 */
import { resolveCompanyTaps } from "./_shared/company-resolve.mjs";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  if (req.method !== "GET") return json(405, { error: "GET only" });

  const url = new URL(req.url);
  const company_number = (url.searchParams.get("company_number") || "").trim();
  const company_name = (url.searchParams.get("name") || "").trim();
  const website = (url.searchParams.get("website") || "").trim() || null;
  const sic = (url.searchParams.get("sic") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const verify = url.searchParams.get("verify") === "1";

  if (!company_number && !company_name) {
    return json(400, { error: "Provide company_number or name" });
  }

  const result = await resolveCompanyTaps({
    company_number,
    company_name,
    sic_codes: sic,
    website,
    verify_contact: verify && !!website,
  });

  return json(200, result);
};

export const config = { path: "/api/tle/resolve" };
