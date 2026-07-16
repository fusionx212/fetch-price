/**
 * Resend delivery templates — matched intel to inbox.
 * Design: clear hierarchy, one job per email, proof dates, no phone numbers.
 */
import { leadToCustomerRow, whyMatched } from "./match.mjs";
import { suggestStockSellers } from "./stock-sellers.mjs";

const FROM =
  process.env.RESEND_FROM || "Regional Commerce Data <brief@regionalcommercedata.co.uk>";
const SITE = "https://regionalcommercedata.co.uk";
const BRAND = "#1f5169";
const MUTED = "#5a6675";
const INK = "#121820";
const PANEL = "#f4f6f8";
const ALERTS_PRICE = "£99/mo";

export async function sendResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${await res.text()}`);
  return res.json();
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(d).slice(0, 10);
  }
}

function btn(href, label) {
  return `<a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:4px">${esc(label)}</a>`;
}

function wrap({ preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Regional Commerce Data</title>
<!--[if !mso]><!--><style>
@media (max-width:620px){
  .wrap{width:100%!important}
  .pad{padding:20px 16px!important}
  .h1m{font-size:24px!important}
  .btnm{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box!important}
  .glance td{display:block!important;width:100%!important;border-bottom:1px solid #e5e9ee}
}
</style><!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#e8ecf0">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8ecf0">
<tr><td align="center" style="padding:16px 10px">
<table role="presentation" class="wrap" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #d5dce3">
<tr><td style="background:${BRAND};padding:16px 20px">
  <p style="margin:0;font-family:Georgia,serif;font-size:20px;color:#fff;letter-spacing:-0.02em">Regional Commerce Data</p>
  <p style="margin:4px 0 0;font-family:sans-serif;font-size:12px;color:#b8d4e3">Monday pack · We supply the intel — you do the work</p>
</td></tr>
<tr><td class="pad" style="padding:24px 20px;font-family:sans-serif;color:${INK};font-size:15px;line-height:1.55">
${body}
</td></tr>
<tr><td style="padding:14px 20px 20px;border-top:1px solid #e5e9ee;font-family:sans-serif;font-size:12px;color:#999;line-height:1.5">
  POLICYANDPLAY LTD · Public register intel only · No personal phone numbers<br>
  <a href="${SITE}/privacy.html" style="color:${MUTED}">Privacy</a> ·
  <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${MUTED}">Unsubscribe</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function glanceRow({ distressN, birthN, sellerN }) {
  return `<table class="glance" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#eef4f8;border:1px solid #d5dce3">
<tr>
  <td align="center" style="padding:14px 8px;width:33%">
    <p style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1;color:${INK};font-weight:600">${distressN}</p>
    <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED}">Distress</p>
  </td>
  <td align="center" style="padding:14px 8px;width:33%;border-left:1px solid #d5dce3">
    <p style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1;color:${INK};font-weight:600">${birthN}</p>
    <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED}">Births</p>
  </td>
  <td align="center" style="padding:14px 8px;width:33%;border-left:1px solid #d5dce3">
    <p style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1;color:${INK};font-weight:600">${sellerN}</p>
    <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED}">Portals</p>
  </td>
</tr>
</table>`;
}

function chipRow(tags) {
  if (!tags?.length) return "";
  const chips = tags
    .slice(0, 8)
    .map(
      (t) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 9px;background:#e2eef4;border:1px solid #c5d9e4;color:${BRAND};font-size:12px;font-weight:600">${esc(String(t).replace(/-/g, " "))}</span>`
    )
    .join("");
  return `<p style="margin:0 0 16px">${chips}</p>`;
}

function factRow(label, value) {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:${MUTED};width:140px;vertical-align:top">${esc(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:${INK};font-weight:600">${value}</td>
  </tr>`;
}

function leadCard(row) {
  const trade = (row.industry_slug || "").replace(/-/g, " ");
  const tier = (row.quality_tier || "gold").toUpperCase();
  return `<div style="background:${PANEL};border-left:4px solid ${BRAND};padding:16px 18px;margin:16px 0">
  <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};font-weight:700">${esc(tier)} MATCH</p>
  <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:20px;color:${INK}">${esc(row.company_name)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${factRow("Company no.", esc(row.company_number))}
    ${factRow("Incorporated", esc(fmtDate(row.incorporated_on)))}
    ${factRow("Listed by us", esc(fmtDate(row.listed_at)))}
    ${factRow("Trade", esc(trade))}
    ${factRow("Area", esc(row.area || row.region_slug || "—"))}
    ${factRow("Why matched", esc(row.why || "matched to your profile"))}
  </table>
</div>`;
}

/** Free signup confirmation */
export function renderWelcomeEmail({ tradeLabel, regionLabel }) {
  return wrap({
    preheader: `You're matched to ${tradeLabel} in ${regionLabel}`,
    body: `
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};font-weight:700">You're on the list</p>
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;font-weight:600;color:${INK}">We'll match new trade firms to you every week.</h1>
    <p style="margin:0 0 16px;color:${MUTED}">Your profile:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};margin:0 0 20px">
      <tr><td style="padding:14px 16px">
        ${factRow("Trade", `<strong>${esc(tradeLabel)}</strong>`)}
        ${factRow("Patch", `<strong>${esc(regionLabel)}</strong>`)}
        ${factRow("Cadence", "<strong>Weekly Monday pulse</strong>")}
      </td></tr>
    </table>
    <p style="margin:0 0 8px;color:${MUTED}"><strong>What lands in your inbox</strong></p>
    <ul style="margin:0 0 20px;padding-left:18px;color:${MUTED}">
      <li>How many new firms matched your trade this week</li>
      <li>Top 3 gold matches — name, area, why they're hot</li>
      <li>One clear next step if you want a full matched row</li>
    </ul>
    <p style="margin:0 0 20px;color:${MUTED}">Public register intel only. We don't send personal phone numbers — you run outreach your way.</p>
    <p style="margin:0 0 8px">${btn(`${SITE}/subscribe/?product=leads`, "Try one matched lead — £5")}</p>
    <p style="margin:12px 0 0;font-size:13px;color:${MUTED}"><a href="${SITE}/methodology.html" style="color:${BRAND}">See how matching works →</a></p>
  `,
  });
}

/** Paid £5 lead delivery */
export function renderLeadPurchaseEmail(lead, profile) {
  const row = leadToCustomerRow(lead);
  const trade = (row.industry_slug || profile.industry_slug || "").replace(/-/g, " ");
  const region = (profile.region_slug || "uk-all").replace(/-/g, " ");
  return wrap({
    preheader: `${row.company_name} — your matched lead`,
    body: `
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};font-weight:700">Paid match delivered</p>
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;font-weight:600;color:${INK}">Your matched lead is ready.</h1>
    <p style="margin:0 0 4px;color:${MUTED}">Matched to <strong>${esc(trade || "your trade")}</strong> · ${esc(region)}</p>
    <p style="margin:0 0 8px;font-size:13px;color:${MUTED}">Proof: incorporated ${esc(fmtDate(row.incorporated_on))} · we listed ${esc(fmtDate(row.listed_at))}</p>
    ${leadCard(row)}
    <p style="margin:0 0 16px;color:${MUTED}">Look this firm up on Companies House or your usual sources. <strong>You</strong> decide how to make contact — we don't distribute personal phone numbers.</p>
    <p style="margin:0 0 8px">${btn(`${SITE}/subscribe/?product=leads`, "Buy another matched lead — £5")}</p>
    <p style="margin:12px 0 0;font-size:13px;color:${MUTED}"><a href="${SITE}/packs/" style="color:${BRAND}">Dealers: weekly product packs — ${ALERTS_PRICE} →</a></p>
  `,
  });
}

/** Free weekly newsletter */
export function renderWeeklyBriefEmail({ profile, matches, totalInPatch, asOf }) {
  const trade = profile.industry_slug ? profile.industry_slug.replace(/-/g, " ") : "all trades";
  const region = (profile.region_slug || "uk-all").replace(/-/g, " ");
  const count = totalInPatch ?? matches.length;
  const asOfLabel = fmtDate(asOf || new Date());

  const cards = (matches || [])
    .slice(0, 3)
    .map((lead, i) => {
      const row = leadToCustomerRow(lead);
      const area = row.area || row.region_slug || "—";
      return `<tr><td style="padding:14px 0;border-top:1px solid #e5e9ee">
        <p style="margin:0 0 2px;font-size:11px;color:${BRAND};font-weight:700">#${i + 1} · ${(row.quality_tier || "gold").toUpperCase()}</p>
        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;color:${INK}">${esc(row.company_name)}</p>
        <p style="margin:0;font-size:13px;color:${MUTED}">${esc(area)} · listed ${esc(fmtDate(row.listed_at))} · ${esc(whyMatched(lead))}</p>
      </td></tr>`;
    })
    .join("");

  return wrap({
    preheader: `${count} new ${trade} matches · ${region} · week of ${asOfLabel}`,
    body: `
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};font-weight:700">Weekly pulse · ${esc(asOfLabel)}</p>
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;font-weight:600;color:${INK}">${esc(String(count))} new matches in your trade.</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};margin:0 0 20px">
      <tr><td style="padding:14px 16px">
        ${factRow("Trade", `<strong>${esc(trade)}</strong>`)}
        ${factRow("Patch", `<strong>${esc(region)}</strong>`)}
        ${factRow("As of", `<strong>${esc(asOfLabel)}</strong>`)}
        ${factRow("Showing", `<strong>Top ${Math.min(3, matches?.length || 0)} you haven't seen</strong>`)}
      </td></tr>
    </table>
    ${
      cards
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>`
        : `<p style="margin:0 0 16px;color:${MUTED}">No new matches this week — we're still watching. Quiet weeks happen.</p>`
    }
    <p style="margin:24px 0 16px;color:${MUTED}">Want the full row (company number, incorporation date, match signals) for one firm?</p>
    <p style="margin:0 0 8px">${btn(`${SITE}/subscribe/?product=leads`, "Get one full matched row — £5")}</p>
    <p style="margin:16px 0 0;font-size:13px;color:${MUTED}">Kit buyers: <a href="${SITE}/packs/" style="color:${BRAND}">weekly product packs — distress + market + stock sellers · ${ALERTS_PRICE}</a></p>
  `,
  });
}

function sectionHead(label) {
  return `<p style="margin:28px 0 10px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND};font-weight:700">${esc(label)}</p>`;
}

function sellerListHtml(sellers) {
  if (!sellers?.length) {
    return `<p style="margin:0 0 12px;color:${MUTED}">No curated portals matched this week’s asset tags — try <a href="https://www.ebay.co.uk/b/Business-Industrial/12576" style="color:${BRAND}">eBay Business &amp; Industrial</a> or John Pye.</p>`;
  }
  return sellers
    .map(
      (s) => `<tr><td style="padding:10px 0;border-top:1px solid #e5e9ee">
      <a class="btnm" href="${esc(s.url)}" style="display:block;background:#eef4f8;border:1px solid #d5dce3;color:${INK};text-decoration:none;font-weight:600;font-size:15px;padding:14px 14px;margin:0 0 6px">${esc(s.name)} →</a>
      <p style="margin:0;font-size:13px;color:${MUTED}">${esc(s.blurb || "")}</p>
    </td></tr>`
    )
    .join("");
}

/**
 * Paid weekly product pack — Distress · Market · Birth teaser · Alternative stock sellers.
 * Thin weeks stay honest: we say when a section is quiet.
 */
export function renderProductPackEmail({
  profile,
  distress = [],
  market = null,
  births = [],
  assetCategories = [],
  alternatives = null,
  asOf,
  thinWeek = false,
}) {
  const trade = profile?.industry_slug ? profile.industry_slug.replace(/-/g, " ") : "your trade";
  const region = (profile?.region_slug || "uk-all").replace(/-/g, " ");
  const asOfLabel = fmtDate(asOf || new Date());
  const cats = assetCategories.length
    ? assetCategories
    : profile?.asset_interests || [];
  const sellers = alternatives || suggestStockSellers(cats, { limit: 3 });

  const distressBlock = distress.length
    ? distress
        .slice(0, 3)
        .map((d) => {
          const band = d.valuations?.[0];
          const bandLine = band
            ? `${String(band.asset_category).replace(/-/g, " ")} · £${band.liquidation_low_gbp ?? "—"} – £${band.liquidation_high_gbp ?? "—"}`
            : "Kit band pending comps";
          return `<tr><td style="padding:16px 12px;border-top:1px solid #e5e9ee;border-left:4px solid #c45c26;background:#fffaf7">
            <p style="margin:0 0 4px;font-size:11px;color:#c45c26;font-weight:700;letter-spacing:0.05em">${esc((d.event_type || "distress").toUpperCase())}</p>
            <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:19px;line-height:1.25;color:${INK}">${esc(d.company_name)}</p>
            <p style="margin:0;font-size:14px;color:${MUTED};line-height:1.4">${esc(fmtDate(d.notice_published_at))}<br>${esc(d.company_number || "—")}<br>${esc(bandLine)}</p>
          </td></tr>`;
        })
        .join("")
    : `<tr><td style="padding:12px 0"><p style="margin:0;color:${MUTED}">Quiet on distress this week — no new Gazette matches in your patch. That’s normal; we don’t invent rows.</p></td></tr>`;

  const marketBlock = market?.items?.length
    ? market.items
        .map(
          (it) => `<tr><td style="padding:10px 0;border-top:1px solid #e5e9ee">
        <p style="margin:0 0 2px;font-size:14px;color:${INK}"><a href="${esc(it.url)}" style="color:${BRAND}">${esc(it.title)}</a>${it.price ? ` · <strong>${esc(it.price)}</strong>` : ""}</p>
      </td></tr>`
        )
        .join("")
    : `<tr><td style="padding:12px 0"><p style="margin:0;color:${MUTED}">No live eBay job-lot sample this week (API off or empty). Use the <strong>Also look here</strong> portals below — same asset tags.</p></td></tr>`;

  const birthBlock = births.length
    ? births
        .slice(0, 2)
        .map((lead, i) => {
          const row = leadToCustomerRow(lead);
          return `<tr><td style="padding:12px 0;border-top:1px solid #e5e9ee">
            <p style="margin:0 0 2px;font-size:11px;color:${BRAND};font-weight:700">BIRTH · #${i + 1}</p>
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:16px;color:${INK}">${esc(row.company_name)}</p>
            <p style="margin:0;font-size:13px;color:${MUTED}">${esc(row.area || "—")} · listed ${esc(fmtDate(row.listed_at))} · ${esc(row.why)}</p>
          </td></tr>`;
        })
        .join("")
    : `<tr><td style="padding:12px 0"><p style="margin:0;color:${MUTED}">No new birth teasers in your trade this week.</p></td></tr>`;

  const honesty = thinWeek
    ? `<div style="background:#fff8f0;border:1px solid #e8c9a8;padding:12px 14px;margin:0 0 20px">
        <p style="margin:0;font-size:13px;color:${INK}"><strong>Thin week.</strong> Fewer than two hard matches. We still send the pack so you see the watch is live — and the alternative sellers stay useful.</p>
      </div>`
    : "";

  return wrap({
    preheader: `Pack · ${distress.length} distress · ${births.length} births · ${trade} · ${asOfLabel}`,
    body: `
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};font-weight:700">Monday pack · ${esc(asOfLabel)}</p>
    <h1 class="h1m" style="margin:0 0 10px;font-family:Georgia,serif;font-size:26px;line-height:1.22;font-weight:600;color:${INK}">${esc(trade)} · ${esc(region)}</h1>
    <p style="margin:0 0 14px;color:${MUTED};font-size:14px">Glance the numbers, then open the rows. Public intel only — you run the deal.</p>
    ${honesty}
    ${glanceRow({ distressN: distress.length, birthN: births.length, sellerN: sellers.length })}
    ${chipRow(cats)}

    ${sectionHead("1 · Distress")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${distressBlock}</table>

    ${sectionHead("2 · Market match")}
    <p style="margin:0 0 8px;font-size:13px;color:${MUTED}">eBay sample when live — else use portals below.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${marketBlock}</table>

    ${sectionHead("3 · Birth teaser")}
    <p style="margin:0 0 8px;font-size:13px;color:${MUTED}">New firms that may need kit soon.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${birthBlock}</table>

    ${sectionHead("4 · Also look here")}
    <p style="margin:0 0 8px;font-size:13px;color:${MUTED}">Tap a portal — curated links only.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sellerListHtml(sellers)}</table>

    <p style="margin:24px 0 10px">${btn(`${SITE}/packs/view/`, "Open phone digest")}</p>
    <p style="margin:0 0 8px"><a class="btnm" href="${SITE}/packs/" style="display:inline-block;color:${BRAND};font-weight:600">Packs sell page →</a></p>
    <p style="margin:12px 0 0;font-size:13px;color:${MUTED}"><a href="https://fetch-price.com/methodology.html" style="color:${BRAND}">How Fetch Price spreads work →</a></p>
  `,
  });
}

/** Distress alert (instant) — also used inside packs */
export function renderDistressAlertEmail({ death, valuations, profile }) {
  const trade = (death.industry_slug || profile?.industry_slug || "").replace(/-/g, " ");
  const region = (profile?.region_slug || death.region_slug || "uk-all").replace(/-/g, " ");
  const band = valuations?.[0];
  const spread = band
    ? `<tr><td style="padding:6px 0;font-size:13px;color:${MUTED}">Kit band</td>
       <td style="padding:6px 0;font-size:14px;color:${INK};font-weight:600">${esc(band.asset_category)} · £${esc(band.liquidation_low_gbp ?? "—")} – £${esc(band.liquidation_high_gbp ?? "—")} clearance</td></tr>`
    : "";

  return wrap({
    preheader: `Distress match · ${death.company_name}`,
    body: `
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};font-weight:700">Early heads-up</p>
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;font-weight:600;color:${INK}">Distress match in your patch.</h1>
    <p style="margin:0 0 16px;color:${MUTED}">Matched to <strong>${esc(trade || "your trade")}</strong> · ${esc(region)}. You decide whether to act.</p>
    <div style="background:${PANEL};border-left:4px solid ${BRAND};padding:16px 18px;margin:0 0 20px">
      <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:20px;color:${INK}">${esc(death.company_name)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${factRow("Signal", esc(death.event_type || "distress"))}
        ${factRow("Public date", esc(fmtDate(death.notice_published_at)))}
        ${factRow("Company no.", esc(death.company_number || "—"))}
        ${spread}
      </table>
    </div>
    <p style="margin:0 0 16px;color:${MUTED}">We don't run the auction or sell anyone's assets. You negotiate your own deal. Spreads are market context, not a formal valuation.</p>
    ${(() => {
      const cats = valuations?.map((v) => v.asset_category).filter(Boolean) || profile?.asset_interests || [];
      const sellers = suggestStockSellers(cats, { limit: 3 });
      if (!sellers.length) return "";
      return `${sectionHead("Also look here")}
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED}">Whole-stock / surplus portals matching these asset tags:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sellerListHtml(sellers)}</table>`;
    })()}
    <p style="margin:24px 0 0">${btn("https://fetch-price.com/methodology.html", "How Fetch Price spreads work")}</p>
  `,
  });
}

export async function logDelivery(sb, { email, deliveryType, entityType, entityId }) {
  await sb.from("tle_delivery_log").upsert(
    {
      email: email.toLowerCase(),
      delivery_type: deliveryType,
      entity_type: entityType,
      entity_id: String(entityId),
      sent_at: new Date().toISOString(),
    },
    { onConflict: "email,delivery_type,entity_type,entity_id", ignoreDuplicates: true }
  );
}
