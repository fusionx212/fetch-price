// Demo dataset — used when Supabase is not configured, so the site renders and deploys
// immediately. Numbers here are illustrative (clearly demo mode); once the farm's daily
// run populates Supabase, data.ts reads live rows instead and this module is unused.
// Prices are GBP list prices; histories are month-end points across the last 12 months.
import type { Vendor, ChangeEvent, PricePoint, Plan } from './types';

const now = new Date('2026-07-01T09:00:00Z');
const monthISO = (back: number) => {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - back);
  return d.toISOString();
};

// 12 month-end dates, oldest first
const MONTHS = Array.from({ length: 12 }, (_, i) => monthISO(11 - i));

interface DemoVendor extends Vendor {
  plans: Plan[];
  // per-plan 12-point history keyed by plan name
  history: Record<string, (number | null)[]>;
  events: Omit<ChangeEvent, 'id' | 'vendor_id' | 'vendor'>[];
}

function v(
  partial: Omit<Vendor, 'currency'> & { currency?: string },
  plans: Plan[],
  history: Record<string, (number | null)[]>,
  events: DemoVendor['events'],
): DemoVendor {
  return { currency: 'GBP', ...partial, plans, history, events };
}

const p = (name: string, price: number | null, unit: string | null, features: string[]): Plan => ({
  name, price, currency: 'GBP', period: 'month', unit, features,
});

// flat 12-month series that steps to `to` at month index `at`
const step = (from: number, to: number, at: number) =>
  MONTHS.map((_, i) => (i < at ? from : to));
const flat = (x: number | null) => MONTHS.map(() => x);

export const DEMO_VENDORS: DemoVendor[] = [
  v(
    { id: 'd-slack', name: 'Slack', slug: 'slack', category: 'saas', pricing_url: 'https://slack.com/intl/en-gb/pricing', affiliate_status: 'none' },
    [
      p('Pro', 8.75, 'per seat', ['unlimited message history', 'unlimited integrations', 'group huddles']),
      p('Business+', 15.0, 'per seat', ['saml sso', 'data exports', '99.99% uptime sla']),
      p('Enterprise Grid', null, 'per seat', ['contact sales']),
    ],
    { Pro: step(7.88, 8.75, 8), 'Business+': step(13.5, 15.0, 8), 'Enterprise Grid': flat(null) },
    [
      { plan_name: 'Pro', detected_at: monthISO(3), change_type: 'price_up', old_value: { price: 7.88 }, new_value: { price: 8.75 }, significance: 92, summary: 'Slack raised the Pro plan from £7.88 to £8.75 per seat per month, an 11% increase, effective March 2026.' },
      { plan_name: 'Business+', detected_at: monthISO(3), change_type: 'price_up', old_value: { price: 13.5 }, new_value: { price: 15.0 }, significance: 91, summary: 'Slack Business+ moved from £13.50 to £15.00 per seat per month in March 2026.' },
    ],
  ),
  v(
    { id: 'd-notion', name: 'Notion', slug: 'notion', category: 'saas', pricing_url: 'https://www.notion.com/pricing', affiliate_status: 'none' },
    [
      p('Plus', 9.5, 'per seat', ['unlimited blocks', 'unlimited file uploads', '30-day page history']),
      p('Business', 15.0, 'per seat', ['saml sso', 'private teamspaces', '90-day page history']),
    ],
    { Plus: step(8.0, 9.5, 6), Business: flat(15.0) },
    [
      { plan_name: 'Plus', detected_at: monthISO(5), change_type: 'price_up', old_value: { price: 8.0 }, new_value: { price: 9.5 }, significance: 93, summary: 'Notion increased the Plus plan from £8.00 to £9.50 per seat per month in February 2026, up 19%.' },
    ],
  ),
  v(
    { id: 'd-monday', name: 'Monday.com', slug: 'monday', category: 'saas', pricing_url: 'https://monday.com/pricing', affiliate_status: 'approved', affiliate_network: 'partnerstack' },
    [
      p('Basic', 9.0, 'per seat', ['unlimited free viewers', '5 GB storage', 'over 200 templates']),
      p('Standard', 12.0, 'per seat', ['timeline & gantt', 'guest access', 'automations 250/mo']),
      p('Pro', 19.0, 'per seat', ['private boards', 'chart view', 'automations 25k/mo']),
    ],
    { Basic: flat(9.0), Standard: step(10.0, 12.0, 7), Pro: flat(19.0) },
    [
      { plan_name: 'Standard', detected_at: monthISO(4), change_type: 'price_up', old_value: { price: 10.0 }, new_value: { price: 12.0 }, significance: 94, summary: 'Monday.com Standard rose from £10.00 to £12.00 per seat per month in March 2026 and the seat minimum increased from 3 to 5.' },
      { plan_name: 'Standard', detected_at: monthISO(4), change_type: 'shrinkflation', old_value: { features: ['seat minimum 3'] }, new_value: { features: ['seat minimum 5'] }, significance: 88, summary: 'Monday.com raised the Standard plan seat minimum from 3 to 5, increasing the effective entry cost regardless of headline price.' },
    ],
  ),
  v(
    { id: 'd-hubspot', name: 'HubSpot Marketing', slug: 'hubspot', category: 'saas', pricing_url: 'https://www.hubspot.com/pricing/marketing', affiliate_status: 'applied', affiliate_network: 'impact' },
    [
      p('Starter', 15.0, 'per seat', ['forms', 'email marketing', 'live chat']),
      p('Professional', 792.0, 'flat', ['omnichannel automation', '2,000 contacts', 'campaign reporting']),
    ],
    { Starter: flat(15.0), Professional: step(740.0, 792.0, 9) },
    [
      { plan_name: 'Professional', detected_at: monthISO(2), change_type: 'price_up', old_value: { price: 740.0 }, new_value: { price: 792.0 }, significance: 90, summary: 'HubSpot Marketing Professional increased from £740 to £792 per month in April 2026.' },
    ],
  ),
  v(
    { id: 'd-xero', name: 'Xero', slug: 'xero', category: 'saas', pricing_url: 'https://www.xero.com/uk/pricing-plans/', affiliate_status: 'applied', affiliate_network: 'awin' },
    [
      p('Ignite', 16.0, 'flat', ['send quotes & 20 invoices', 'reconcile bank', 'capture bills']),
      p('Grow', 33.0, 'flat', ['unlimited invoices', 'bulk reconcile', 'short-term cash flow']),
      p('Comprehensive', 47.0, 'flat', ['multi-currency', 'projects', 'analytics']),
    ],
    { Ignite: step(15.0, 16.0, 10), Grow: step(30.0, 33.0, 10), Comprehensive: step(42.0, 47.0, 10) },
    [
      { plan_name: 'Comprehensive', detected_at: monthISO(1), change_type: 'price_up', old_value: { price: 42.0 }, new_value: { price: 47.0 }, significance: 91, summary: 'Xero Comprehensive rose from £42 to £47 per month in May 2026, up 12%.' },
    ],
  ),
  v(
    { id: 'd-canva', name: 'Canva', slug: 'canva', category: 'saas', pricing_url: 'https://www.canva.com/en_gb/pricing/', affiliate_status: 'none' },
    [
      p('Teams', 8.0, 'per seat', ['brand kit', 'unlimited premium content', 'approvals']),
    ],
    { Teams: step(8.6, 8.0, 5) },
    [
      { plan_name: 'Teams', detected_at: monthISO(6), change_type: 'price_down', old_value: { price: 8.6 }, new_value: { price: 8.0 }, significance: 90, summary: 'Canva Teams reduced from £8.60 to £8.00 per seat per month in January 2026 following the pricing revision.' },
    ],
  ),
  v(
    { id: 'd-zoom', name: 'Zoom', slug: 'zoom', category: 'saas', pricing_url: 'https://www.zoom.com/en/pricing/', affiliate_status: 'none' },
    [
      p('Pro', 12.49, 'per seat', ['30-hour meetings', 'cloud recording 5 GB', 'clips']),
      p('Business', 18.32, 'per seat', ['300 attendees', 'sso', 'managed domains']),
    ],
    { Pro: flat(12.49), Business: flat(18.32) },
    [],
  ),
  v(
    { id: 'd-github', name: 'GitHub', slug: 'github', category: 'saas', pricing_url: 'https://github.com/pricing', affiliate_status: 'none' },
    [
      p('Team', 3.5, 'per seat', ['protected branches', 'code owners', '3,000 actions min/mo']),
      p('Enterprise', 15.75, 'per seat', ['saml sso', 'audit log api', '50,000 actions min/mo']),
    ],
    { Team: flat(3.5), Enterprise: flat(15.75) },
    [],
  ),
  // ── broadband / telecoms (Sprint 5 category, seeded here for the demo) ──
  v(
    { id: 'd-bt-business', name: 'BT Business Broadband', slug: 'bt-business-broadband', category: 'broadband', pricing_url: 'https://business.bt.com/broadband/', affiliate_status: 'none' },
    [
      p('Essential Fibre', 32.99, 'flat', ['avg 76 Mbps', 'static IP option', '24/7 support']),
      p('Complete Fibre', 44.99, 'flat', ['avg 900 Mbps', 'static IP included', '4G backup']),
    ],
    { 'Essential Fibre': step(29.99, 32.99, 8), 'Complete Fibre': step(41.99, 44.99, 8) },
    [
      { plan_name: 'Essential Fibre', detected_at: monthISO(3), change_type: 'price_up', old_value: { price: 29.99 }, new_value: { price: 32.99 }, significance: 92, summary: 'BT Business Essential Fibre increased from £29.99 to £32.99 per month in March 2026, a mid-contract CPI-linked rise of 10%.' },
    ],
  ),
  v(
    { id: 'd-vodafone-business', name: 'Vodafone Business Mobile', slug: 'vodafone-business-mobile', category: 'telecoms', pricing_url: 'https://www.vodafone.co.uk/business/', affiliate_status: 'none' },
    [
      p('Unlimited Lite', 18.0, 'per line', ['unlimited mins & texts', 'unlimited data (2 Mbps)', 'eu roaming']),
      p('Unlimited Max', 26.0, 'per line', ['unlimited full-speed data', '5g', 'global roaming 80 destinations']),
    ],
    { 'Unlimited Lite': flat(18.0), 'Unlimited Max': step(24.0, 26.0, 9) },
    [
      { plan_name: 'Unlimited Max', detected_at: monthISO(2), change_type: 'price_up', old_value: { price: 24.0 }, new_value: { price: 26.0 }, significance: 90, summary: 'Vodafone Business Unlimited Max rose from £24 to £26 per line per month in April 2026.' },
    ],
  ),
];

/** Derive a plan's price history as chartable points. */
export function demoHistory(v: DemoVendor, planName: string): PricePoint[] {
  const series = v.history[planName] || [];
  return MONTHS.map((date, i) => ({ date, price: series[i] ?? null }));
}

export function demoChangeEvents(): ChangeEvent[] {
  const out: ChangeEvent[] = [];
  for (const v of DEMO_VENDORS) {
    for (const [i, e] of v.events.entries()) {
      out.push({ id: `${v.id}-e${i}`, vendor_id: v.id, vendor: v, ...e });
    }
  }
  return out.sort((a, b) => +new Date(b.detected_at) - +new Date(a.detected_at));
}
