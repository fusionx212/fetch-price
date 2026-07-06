import type { Plan, PricePoint, ChangeType } from './types';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2 });

const SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
export function money(price: number | null, currency = 'GBP'): string {
  if (price == null) return 'POA';
  if (currency === 'GBP') return gbp.format(price);
  return `${SYMBOL[currency] ?? ''}${price}`;
}

/** "£8.75/seat" | "£47/mo" | "£792/mo flat" | "POA" */
export function priceLabel(p: Plan): string {
  if (p.price == null) return 'POA';
  const per =
    p.unit === 'per seat' ? '/seat'
    : p.unit === 'per line' ? '/line'
    : p.unit === 'per GB' ? '/GB'
    : '';
  const period = p.period === 'year' ? '/yr' : p.period === 'usage' ? '' : '/mo';
  return `${money(p.price, p.currency)}${per}${per ? ' ' + period : period}`.trim();
}

/** Current deal on a plan: the promo price + % saving vs list, or null. */
export function dealInfo(p: Plan): { price: string; save: number; note: string | null } | null {
  if (p.deal_price == null || p.price == null || p.deal_price >= p.price) return null;
  return {
    price: money(p.deal_price, p.currency),
    save: Math.round((1 - p.deal_price / p.price) * 100),
    note: p.deal_note ?? null,
  };
}

export function pct(oldP?: number | null, newP?: number | null): number | null {
  if (typeof oldP !== 'number' || typeof newP !== 'number' || oldP === 0) return null;
  return ((newP - oldP) / oldP) * 100;
}

export function deltaChip(oldP?: number | null, newP?: number | null): { text: string; dir: 'rise' | 'drop' | 'flat' } | null {
  const change = pct(oldP, newP);
  if (change == null || Math.abs(change) < 0.5) return null;
  const dir = change > 0 ? 'rise' : 'drop';
  const arrow = change > 0 ? '▲' : '▼';
  return { text: `${arrow} ${Math.abs(change).toFixed(0)}%`, dir };
}

const REL = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
export function checkedAgo(iso: string | null, ref = new Date('2026-07-05T12:00:00Z')): string {
  if (!iso) return '';
  const diffH = Math.round((ref.getTime() - new Date(iso).getTime()) / 3.6e6);
  if (diffH < 24) return `checked ${diffH <= 1 ? 'just now' : REL.format(-diffH, 'hour')}`;
  const days = Math.round(diffH / 24);
  return `checked ${REL.format(-days, 'day')}`;
}

export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const CHANGE_LABEL: Record<ChangeType, string> = {
  price_up: 'Price rise', price_down: 'Price cut', plan_added: 'Plan added',
  plan_removed: 'Plan removed', shrinkflation: 'Shrinkflation', packaging: 'Repackaged',
  copy: 'Copy change', cosmetic: 'Minor',
};

/** Build an SVG polyline path from history points (nulls skipped). Returns null if <2 points. */
export function sparkPath(points: PricePoint[], w = 120, h = 34, pad = 3): { line: string; area: string; last: 'rise' | 'drop' | 'flat' } | null {
  const vals = points.map((p) => p.price).filter((x): x is number => typeof x === 'number');
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const n = points.length - 1;
  const xy = points.map((p, i) => {
    const x = pad + (i / n) * (w - 2 * pad);
    const y = p.price == null ? null : h - pad - ((p.price - min) / span) * (h - 2 * pad);
    return { x, y };
  }).filter((c) => c.y != null) as { x: number; y: number }[];
  const line = xy.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy[xy.length - 1].x.toFixed(1)} ${h - pad} L${xy[0].x.toFixed(1)} ${h - pad} Z`;
  const a = vals[vals.length - 2], b = vals[vals.length - 1];
  const last = b > a ? 'rise' : b < a ? 'drop' : 'flat';
  return { line, area, last };
}
