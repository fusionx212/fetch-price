/**
 * Robots-safe public taps for pack / side-flow workbench.
 * Anti-ban: no CAPTCHA bypass, no identity/proxy rotation, rate-limited,
 * soft-fail on robots.txt deny or fetch errors. Public register + open web only.
 */
const CH_BASE = "https://find-and-update.company-information.service.gov.uk";
const FETCH_TIMEOUT_MS = 8000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

const rateBucket = new Map();

function rateOk(key) {
  const now = Date.now();
  const hits = (rateBucket.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rateBucket.set(key, hits);
    return false;
  }
  hits.push(now);
  rateBucket.set(key, hits);
  return true;
}

export function companiesHouseUrl(companyNumber) {
  if (!companyNumber) return null;
  return `${CH_BASE}/company/${encodeURIComponent(String(companyNumber))}`;
}

/** Public CH advanced search — peer firms by SIC (user opens; we don't scrape). */
export function peerSearchUrl(sicCodes = []) {
  const sic = (sicCodes || []).map(String).filter(Boolean)[0];
  if (!sic) {
    return `${CH_BASE}/advanced-search`;
  }
  const params = new URLSearchParams({
    sicCodes: sic,
    status: "active",
  });
  return `${CH_BASE}/advanced-search/get-results?${params}`;
}

/** Open web search for company website — user-initiated, no scrape. */
export function websiteSearchUrl(companyName, companyNumber) {
  const q = [companyName, companyNumber, "UK", "official site"]
    .filter(Boolean)
    .join(" ");
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

export function contactPageGuessUrl(website) {
  if (!website) return null;
  try {
    const u = new URL(website.includes("://") ? website : `https://${website}`);
    u.pathname = "/contact";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Build instant public taps (no network). Soft placeholders when data missing.
 */
export function buildPublicTaps({
  company_number,
  company_name,
  sic_codes = [],
  website = null,
} = {}) {
  const ch = companiesHouseUrl(company_number);
  const peer = peerSearchUrl(sic_codes);
  const webSearch = websiteSearchUrl(company_name, company_number);
  const contactGuess = contactPageGuessUrl(website);
  return {
    companies_house: ch
      ? { label: "Companies House", url: ch, status: "ready" }
      : { label: "Companies House", url: null, status: "missing" },
    peers: {
      label: "Peer firms (same SIC)",
      url: peer,
      status: "ready",
      note: "Opens Companies House advanced search — public register only.",
    },
    website: website
      ? { label: "Website", url: website.startsWith("http") ? website : `https://${website}`, status: "ready" }
      : {
          label: "Find website",
          url: webSearch,
          status: "search",
          note: "Open search — we don’t invent domains or scrape.",
        },
    contact: contactGuess
      ? {
          label: "Contact page (guess)",
          url: contactGuess,
          status: "unverified",
          note: "Guessed /contact — verify before outreach. Soft-fail if blocked.",
        }
      : {
          label: "Contact page",
          url: webSearch,
          status: "search",
          note: "No website on file — search first, then check /contact yourself.",
        },
  };
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Parse robots.txt allow/disallow for a path (simple, User-agent: * only).
 * Fail-open only when robots.txt missing/unreadable; fail-closed on explicit Disallow.
 */
export function isPathAllowedByRobots(robotsTxt, path) {
  if (!robotsTxt || typeof robotsTxt !== "string") return true;
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.trim());
  let inStar = false;
  const rules = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const lower = line.toLowerCase();
    if (lower.startsWith("user-agent:")) {
      const ua = line.slice(line.indexOf(":") + 1).trim();
      inStar = ua === "*";
      continue;
    }
    if (!inStar) continue;
    if (lower.startsWith("disallow:")) {
      rules.push({ allow: false, path: line.slice(line.indexOf(":") + 1).trim() || "/" });
    } else if (lower.startsWith("allow:")) {
      rules.push({ allow: true, path: line.slice(line.indexOf(":") + 1).trim() });
    }
  }
  const pathname = path.startsWith("/") ? path : `/${path}`;
  let allowed = true;
  let bestLen = -1;
  for (const r of rules) {
    if (!r.path) continue;
    if (pathname.startsWith(r.path) || r.path === "/") {
      if (r.path.length >= bestLen) {
        bestLen = r.path.length;
        allowed = r.allow;
      }
    }
  }
  return allowed;
}

/**
 * HEAD/GET a contact URL only when robots.txt allows. Soft-fail always.
 */
export async function verifyContactPage(websiteOrContact, { fetchImpl = fetch } = {}) {
  const contactUrl = contactPageGuessUrl(websiteOrContact) || websiteOrContact;
  if (!contactUrl) {
    return { ok: false, status: "missing", url: null, reason: "no_url" };
  }
  const origin = originOf(contactUrl);
  if (!origin) {
    return { ok: false, status: "invalid", url: contactUrl, reason: "bad_url" };
  }
  if (!rateOk(origin)) {
    return { ok: false, status: "rate_limited", url: contactUrl, reason: "rate_limit" };
  }

  let pathname = "/contact";
  try {
    pathname = new URL(contactUrl).pathname || "/contact";
  } catch {
    /* keep default */
  }

  try {
    const robotsRes = await fetchImpl(`${origin}/robots.txt`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "text/plain,*/*", "User-Agent": "RCD-PackResolve/1.0 (+https://regionalcommercedata.co.uk)" },
    });
    if (robotsRes.ok) {
      const txt = await robotsRes.text();
      if (!isPathAllowedByRobots(txt, pathname)) {
        return { ok: false, status: "robots_blocked", url: contactUrl, reason: "robots_disallow" };
      }
    }
  } catch {
    // Soft-fail robots fetch: still attempt a gentle HEAD (many sites lack robots.txt)
  }

  try {
    const head = await fetchImpl(contactUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "RCD-PackResolve/1.0 (+https://regionalcommercedata.co.uk)" },
    });
    if (head.ok || (head.status >= 300 && head.status < 400)) {
      return { ok: true, status: "reachable", url: contactUrl, http_status: head.status };
    }
    // Some hosts reject HEAD — soft GET
    const get = await fetchImpl(contactUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "RCD-PackResolve/1.0 (+https://regionalcommercedata.co.uk)" },
    });
    if (get.ok) {
      return { ok: true, status: "reachable", url: contactUrl, http_status: get.status };
    }
    return {
      ok: false,
      status: "unreachable",
      url: contactUrl,
      http_status: get.status,
      reason: "http_error",
    };
  } catch (e) {
    return {
      ok: false,
      status: "soft_fail",
      url: contactUrl,
      reason: e?.name === "TimeoutError" ? "timeout" : "fetch_error",
    };
  }
}

/**
 * Full resolve payload for API + side flow.
 */
export async function resolveCompanyTaps(input = {}, opts = {}) {
  const taps = buildPublicTaps(input);
  let contactVerify = null;
  if (input.website || input.verify_contact) {
    contactVerify = await verifyContactPage(input.website || taps.contact.url, opts);
    if (contactVerify.ok) {
      taps.contact = {
        ...taps.contact,
        url: contactVerify.url,
        status: "verified",
        note: "Contact path reachable and robots-allowed.",
      };
    } else if (contactVerify.status === "robots_blocked") {
      taps.contact = {
        ...taps.contact,
        status: "robots_blocked",
        note: "robots.txt disallows /contact — we won’t fetch it. Open the homepage yourself.",
      };
    } else {
      taps.contact = {
        ...taps.contact,
        status: contactVerify.status || "soft_fail",
        note: "Couldn’t verify contact page — open Companies House or search instead.",
      };
    }
  }
  return {
    company_number: input.company_number || null,
    company_name: input.company_name || null,
    taps,
    contact_verify: contactVerify,
    policy: {
      robots_safe: true,
      no_captcha_bypass: true,
      no_identity_rotation: true,
      soft_fail: true,
    },
  };
}
