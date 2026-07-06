// Editorial buying-guide content — the single source of truth for /best/{slug} pages.
// Structural/qualitative advice ONLY lives here (how to choose, what matters, budget tiers).
// Every PRICE and every vendor-specific claim is computed at render time in
// src/pages/best/[slug].astro straight from the live data layer (lib/data.ts) —
// never hardcode a price or a vendor ranking in this file.
export interface WhatMatters { title: string; body: string; }
export interface BudgetTier { label: string; body: string; }
export interface FaqEntry { q: string; a: string; }

export interface BuyingGuide {
  slug: string;               // /best/{slug}/
  category: string;           // matches Vendor.category exactly
  kicker: string;             // small eyebrow label
  faqNoun: string;            // natural-language noun phrase for auto-built FAQ questions, e.g. "CRM"
  h1: string;
  dek: string;                // one-line standfirst
  intro: string[];            // 2-3 paragraphs, generic category context (no prices)
  whatMatters: WhatMatters[];
  budgetTiers: BudgetTier[];
  faqs: FaqEntry[];           // generic, non-price-specific FAQs (price FAQs are built at render time)
}

export const BUYING_GUIDES: BuyingGuide[] = [
  {
    slug: 'project-management-software-uk',
    category: 'project-management',
    kicker: 'Project management',
    faqNoun: 'project management tool',
    h1: 'The best project management software for UK teams',
    dek: 'Every project and work-management tool we track, compared on the price each vendor is actually charging today — not the number on their sales page.',
    intro: [
      "Project management tools are the easiest SaaS category to overspend on, because almost every vendor prices per seat and quietly assumes you'll add more seats over time. The tool that looks cheapest for a five-person team can end up the most expensive once you've onboarded twenty.",
      "There is no single best tool here — a solo consultant, a ten-person agency and a fifty-person operations team have genuinely different requirements. What follows is a comparison of what each vendor is charging right now, tracked and re-checked on a regular cycle, plus the questions worth asking before you commit a team to one for a year.",
    ],
    whatMatters: [
      { title: 'Per-seat billing scales with headcount', body: "Most of the tools below charge per seat, per month. A 'from £X' headline price only tells you the cost for one person — multiply by your actual (and planned) headcount before you compare vendors, not after." },
      { title: 'Free tiers cap out fast', body: 'A genuinely free tier is common in this category, but almost all of them cap the number of members, boards, or storage. Check the limit against your team size before you build a workflow on the free plan and then have to migrate off it.' },
      { title: 'Switching cost is real and rarely priced in', body: "Moving boards, tasks, automations and history from one tool to another costs hours, not pounds — and it is not on any pricing page. A slightly pricier tool that fits how your team already works usually beats the cheapest one you'll end up rebuilding in six months." },
    ],
    budgetTiers: [
      { label: 'Solo or two-person team', body: 'A genuine free tier (see the table below for which vendors currently offer one) covers most solo and pair workflows. Do not pay until you hit a real, named limit — not a hypothetical future one.' },
      { label: 'Small team (roughly 3–15 people)', body: "This is where per-seat plans start to bite. Run the maths at your actual headcount against each vendor's mid-tier plan — the gap between the cheapest and most expensive option widens fast at this size." },
      { label: 'Growing team or multiple departments', body: "Look for a flat-rate 'business' style tier rather than pure per-seat pricing, or ask the vendor directly about seat pricing at volume — several vendors' top tiers are quote-only for a reason." },
    ],
    faqs: [
      { q: 'Is a free project management tool actually usable for a small team?', a: 'For a small team with light needs, often yes — several vendors in this category offer an uncapped-time free tier, though usually with limits on member count, boards, or automation. Check the specific limits against your team size rather than assuming "free" means "full-featured".' },
      { q: 'How often is this pricing checked?', a: "We re-check every vendor's pricing page on a regular automated schedule and log every change we detect, dated, with the old and new price. The 'checked' timestamp on each row below shows exactly when we last confirmed it." },
    ],
  },
  {
    slug: 'crm-for-small-business-uk',
    category: 'crm',
    kicker: 'CRM',
    faqNoun: 'CRM',
    h1: 'The cheapest CRM for small businesses in the UK',
    dek: "Every CRM we track, compared on the plan price each vendor is charging right now — including which ones actually have a usable free tier and which don't.",
    intro: [
      "CRM pricing is where SaaS vendors get most aggressive with per-seat costs and tiered gating — the plan that looks affordable in the marketing email is frequently not the plan you'd actually need once you check which features sit behind the next tier up.",
      'The comparison below is the plan price we have most recently confirmed for each vendor, tracked on a regular cycle so it reflects what they are charging now rather than what they were charging when a review site last checked.',
    ],
    whatMatters: [
      { title: 'Per-seat pricing multiplies fast', body: 'CRM tools are among the highest per-seat SaaS costs of any category we track. A headline "from £X per seat" figure can look very different once you multiply it by a 5- or 10-person sales team — do that maths before shortlisting.' },
      { title: 'Enterprise tiers are frequently quote-only', body: "Several of the vendors below cap their published pricing at a mid-tier and mark anything beyond it 'contact sales'. If that is the tier your team actually needs, budget for a sales conversation and a negotiated price — not the self-serve number on the page." },
      { title: "A vendor's 'free CRM' is often a loss-leader for something else", body: "Where a free tier exists, check what product it actually belongs to. Some 'free CRM' tiers are entry points into a wider marketing or sales suite rather than a standalone dedicated CRM — read the plan name carefully, not just the price." },
    ],
    budgetTiers: [
      { label: 'Solo founder or freelancer', body: 'A free or lowest-priced per-seat plan is usually enough for basic contact and pipeline tracking. Confirm contact-record limits before you import your whole address book.' },
      { label: 'Small sales team (2–10 people)', body: "This is where the standard or 'professional' tier matters — check what's gated behind it (custom fields, reporting, integrations) against what your team actually needs day to day." },
      { label: 'Scaling or multi-department', body: "Enterprise-tier CRM is usually a quote, not a checkout. Treat the published price of the tier below it as a floor, not the number you'll actually pay." },
    ],
    faqs: [
      { q: 'What is the cheapest CRM for a small UK business?', a: "It changes as vendors update pricing, which is exactly why we track it rather than publish a fixed answer — see the live comparison table above for the current cheapest tracked plan, dated to when we last checked it." },
      { q: 'Do these CRMs offer a genuinely free plan?', a: "A minority do. Where a vendor currently has a £0 plan live on its pricing page, it's marked in the table above — but free CRM tiers are usually capped hard on contacts, seats, or automation, so check the limit before you rely on it." },
    ],
  },
  {
    slug: 'accounting-software-for-small-business-uk',
    category: 'accounting',
    kicker: 'Accounting',
    faqNoun: 'accounting tool',
    h1: 'The best accounting software for small businesses in the UK',
    dek: 'Sole trader through limited company: the accounting platforms we track, compared on the price each vendor is charging today, checked on a regular cycle.',
    intro: [
      "Accounting software pricing in the UK splits sharply by business structure — a sole trader plan and a limited company plan from the same vendor can be priced and featured very differently, and it is easy to compare the wrong pair of tiers by accident.",
      "The table below shows the current plan price we have most recently confirmed for each vendor. Making Tax Digital (MTD) support for VAT and, from the relevant year, Income Tax, is table stakes for any UK small-business accounting tool — confirm it before price, not after.",
    ],
    whatMatters: [
      { title: 'Sole trader and limited company pricing often differ', body: 'Several vendors below price a sole-trader plan separately from a limited-company plan. Make sure the plan you are comparing actually matches your business structure — a cheaper sole-trader plan is not a fair comparison against a limited-company competitor.' },
      { title: 'Monthly vs annual billing changes the comparison', body: 'Some plans are billed monthly, others as a single annual charge. Always convert to a monthly-equivalent figure in your own head before deciding one is cheaper than another — the raw headline numbers are not always on the same basis.' },
      { title: 'MTD compliance is a baseline requirement, not a differentiator', body: 'Making Tax Digital rules mean any UK accounting tool you shortlist should already support MTD filing for your obligations. Confirm this directly with the vendor for your specific business type before you commit, regardless of price.' },
    ],
    budgetTiers: [
      { label: 'Sole trader or freelancer', body: 'Look for a genuine sole-trader tier rather than a scaled-down company plan — pricing and feature sets for sole traders are usually simpler and cheaper across the vendors below.' },
      { label: 'Small limited company', body: 'The standard tier is usually where payroll and VAT filing support are unlocked — check that both are included, or priced separately as an add-on, before comparing headline prices.' },
      { label: 'Growing company with a bookkeeper or accountant', body: 'Confirm whether multi-user seats or accountant access are included in the plan price or charged as an extra — this is a common place for the real monthly cost to exceed the advertised one.' },
    ],
    faqs: [
      { q: 'Is the cheapest accounting software plan always the right choice?', a: 'No — check MTD support, payroll/VAT inclusion, and whether the plan matches your business structure (sole trader vs limited company) first. Price is the last filter, not the first, in this category.' },
      { q: 'How often is this pricing checked?', a: "We re-check every vendor's pricing page on a regular automated schedule and log every change we detect, dated. The 'checked' timestamp on each row above shows exactly when we last confirmed it." },
    ],
  },
];

export function getBuyingGuide(slug: string): BuyingGuide | undefined {
  return BUYING_GUIDES.find((g) => g.slug === slug);
}

/** Guide (if any) that covers a given vendor category — for cross-linking from other pages. */
export function guideForCategory(category: string): BuyingGuide | undefined {
  return BUYING_GUIDES.find((g) => g.category === category);
}
