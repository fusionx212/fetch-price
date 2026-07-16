/**
 * Pair intelligence to a subscriber and deliver.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchMatchedLeads,
  fetchMatchedDeaths,
  filterUndelivered,
  normalizeProfile,
} from "./match.mjs";
import {
  sendResend,
  renderLeadPurchaseEmail,
  renderWeeklyBriefEmail,
  renderDistressAlertEmail,
  renderProductPackEmail,
  logDelivery,
} from "./delivery.mjs";
import { suggestStockSellers, optionalEbayJobLotHint } from "./stock-sellers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function assetCategoriesForIndustry(slug) {
  try {
    const candidates = [
      join(__dirname, "../../../config/industries.json"),
      join(__dirname, "industries.json"),
    ];
    for (const path of candidates) {
      try {
        const cfg = JSON.parse(readFileSync(path, "utf8"));
        const ind = (cfg.industries || []).find((i) => i.slug === slug);
        if (ind?.asset_categories) return ind.asset_categories;
      } catch {
        /* try next */
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function upsertSubscriberProfile(sb, profile) {
  const p = normalizeProfile(profile);
  if (!p.email) throw new Error("Profile email required");
  const { data, error } = await sb
    .from("tle_subscriber_profiles")
    .upsert(
      {
        email: p.email,
        industry_slug: p.industry_slug,
        region_slug: p.region_slug,
        asset_interests: p.asset_interests,
        delivery_cadence: p.delivery_cadence,
        is_free_list: p.is_free_list,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function fulfillPredatorPurchase(sb, email, profile, sessionId) {
  const normalized = normalizeProfile({ ...profile, email });
  const candidates = await fetchMatchedLeads(sb, normalized, { tier: "gold", limit: 25, unsoldOnly: true });
  const fresh = await filterUndelivered(sb, email, "lead_purchase", "lead", candidates, "company_number");
  const lead = fresh[0];
  if (!lead) {
    console.warn("No matched lead available for", email);
    return { ok: false, reason: "no_match" };
  }

  const now = new Date().toISOString();
  await sb
    .from("tle_leads")
    .update({ sold_at: now, purchased_by_email: email.toLowerCase() })
    .eq("id", lead.id);

  await sb.from("tle_lead_purchases").insert({
    email: email.toLowerCase(),
    lead_id: lead.id,
    company_number: lead.company_number,
    stripe_checkout_session_id: sessionId,
    delivered_at: now,
  });

  await sendResend({
    to: email,
    subject: `Your matched lead · ${lead.tle_companies?.company_name || lead.company_number}`,
    html: renderLeadPurchaseEmail(lead, normalized),
  });

  await logDelivery(sb, {
    email,
    deliveryType: "lead_purchase",
    entityType: "lead",
    entityId: lead.company_number,
  });

  return { ok: true, company_number: lead.company_number };
}

export async function deliverWeeklyBriefs(sb) {
  const { data: profiles } = await sb
    .from("tle_subscriber_profiles")
    .select("*")
    .eq("is_free_list", true);
  let sent = 0;
  for (const profile of profiles || []) {
    const matches = await fetchMatchedLeads(sb, profile, { tier: "gold", limit: 15, unsoldOnly: true });
    const fresh = await filterUndelivered(sb, profile.email, "weekly_brief", "lead", matches, "company_number");
    const top = fresh.slice(0, 3);
    if (!top.length) continue;

    await sendResend({
      to: profile.email,
      subject: `RCD pulse · ${top.length} new matches in your trade`,
      html: renderWeeklyBriefEmail({ profile, matches: top, totalInPatch: fresh.length }),
    });

    for (const lead of top) {
      await logDelivery(sb, {
        email: profile.email,
        deliveryType: "weekly_brief",
        entityType: "lead",
        entityId: lead.company_number,
      });
    }

    await sb
      .from("tle_subscriber_profiles")
      .update({ last_weekly_at: new Date().toISOString() })
      .eq("email", profile.email);
    sent++;
  }
  return { sent };
}

export async function deliverDistressAlerts(sb) {
  const { data: subs } = await sb
    .from("tle_subscriptions")
    .select("email")
    .eq("revenue_pillar", "vulture")
    .eq("status", "active");
  let sent = 0;
  for (const sub of subs || []) {
    const { data: profile } = await sb
      .from("tle_subscriber_profiles")
      .select("*")
      .eq("email", sub.email)
      .maybeSingle();
    if (!profile) continue;

    const since = profile.last_alert_at || new Date(Date.now() - 7 * 86400000).toISOString();
    const deaths = await fetchMatchedDeaths(sb, profile, { since, limit: 10 });
    const fresh = await filterUndelivered(sb, profile.email, "distress_alert", "death", deaths, "id");
    for (const death of fresh.slice(0, 5)) {
      let valuations = [];
      if (death.company_number) {
        const { data: vals } = await sb
          .from("tle_valuations")
          .select("asset_category, liquidation_low_gbp, liquidation_high_gbp")
          .eq("company_number", death.company_number)
          .limit(3);
        valuations = vals || [];
      }
      await sendResend({
        to: profile.email,
        subject: `Distress match · ${death.company_name}`,
        html: renderDistressAlertEmail({ death, valuations, profile }),
      });
      await logDelivery(sb, {
        email: profile.email,
        deliveryType: "distress_alert",
        entityType: "death",
        entityId: death.id,
      });
      sent++;
    }
    if (fresh.length) {
      await sb
        .from("tle_subscriber_profiles")
        .update({ last_alert_at: new Date().toISOString() })
        .eq("email", profile.email);
    }
  }
  return { sent };
}

/** Paid Alerts (£99): weekly product pack with alternatives */
export async function deliverProductPacks(sb) {
  const { data: subs } = await sb
    .from("tle_subscriptions")
    .select("email")
    .eq("revenue_pillar", "vulture")
    .eq("status", "active");
  let sent = 0;
  for (const sub of subs || []) {
    const { data: profile } = await sb
      .from("tle_subscriber_profiles")
      .select("*")
      .eq("email", sub.email)
      .maybeSingle();
    if (!profile) continue;

    const since = profile.last_pack_at || new Date(Date.now() - 7 * 86400000).toISOString();
    const deaths = await fetchMatchedDeaths(sb, profile, { since, limit: 8 });
    const freshDeaths = await filterUndelivered(
      sb,
      profile.email,
      "product_pack",
      "death",
      deaths,
      "id"
    );

    const births = await fetchMatchedLeads(sb, profile, { tier: "gold", limit: 8, unsoldOnly: true });
    const freshBirths = await filterUndelivered(
      sb,
      profile.email,
      "product_pack_birth",
      "lead",
      births,
      "company_number"
    );

    const assetCategories =
      profile.asset_interests?.length > 0
        ? profile.asset_interests
        : assetCategoriesForIndustry(profile.industry_slug);

    const distress = [];
    for (const death of freshDeaths.slice(0, 5)) {
      let valuations = [];
      if (death.company_number) {
        const { data: vals } = await sb
          .from("tle_valuations")
          .select("asset_category, liquidation_low_gbp, liquidation_high_gbp")
          .eq("company_number", death.company_number)
          .limit(3);
        valuations = vals || [];
      }
      distress.push({ ...death, valuations });
    }

    const keyword = assetCategories[0] || profile.industry_slug || "plant";
    const market = await optionalEbayJobLotHint(String(keyword).replace(/-/g, " "));
    const alternatives = suggestStockSellers(assetCategories, { limit: 3 });
    const packBirths = freshBirths.slice(0, 3);
    const matchCount = distress.length + Math.min(3, packBirths.length);
    const thinWeek = matchCount < 2;

    await sendResend({
      to: profile.email,
      subject: thinWeek
        ? `RCD pack · thin week · ${profile.industry_slug || "your trade"}`
        : `RCD product pack · ${distress.length} distress · ${profile.industry_slug || "trade"}`,
      html: renderProductPackEmail({
        profile,
        distress,
        market,
        births: packBirths,
        assetCategories,
        alternatives,
        thinWeek,
      }),
    });

    for (const death of distress) {
      await logDelivery(sb, {
        email: profile.email,
        deliveryType: "product_pack",
        entityType: "death",
        entityId: death.id,
      });
    }
    for (const lead of packBirths) {
      await logDelivery(sb, {
        email: profile.email,
        deliveryType: "product_pack_birth",
        entityType: "lead",
        entityId: lead.company_number,
      });
    }

    await sb
      .from("tle_subscriber_profiles")
      .update({ last_pack_at: new Date().toISOString() })
      .eq("email", profile.email);
    sent++;
  }
  return { sent };
}
