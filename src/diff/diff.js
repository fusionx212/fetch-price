// Diff engine. Hash gate keeps AI cost at zero for unchanged pages.
import { createHash } from 'node:crypto';
import { aiJson } from '../ai/client.js';
import { semanticDiff } from '../ai/prompts.js';

export function normalise(extracted) {
  const plans = [...(extracted.plans || [])]
    .map((p) => ({
      name: (p.name || '').trim(),
      price: p.price ?? null,
      deal_price: (typeof p.deal_price === 'number' && p.price && p.deal_price < p.price) ? p.deal_price : null,
      deal_note: p.deal_note ?? null,
      currency: p.currency || 'GBP',
      period: p.period || 'month',
      unit: p.unit ?? null,
      features: (p.features || []).map((f) => f.trim().toLowerCase()).sort()
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { plans };
}

export function hashExtracted(norm) {
  return createHash('sha256').update(JSON.stringify(norm)).digest('hex');
}

// Deterministic significance floor — AI summarises, rules score.
export function scoreChange(c) {
  switch (c.change_type) {
    case 'price_up':
    case 'price_down': {
      const oldP = c.old_value?.price, newP = c.new_value?.price;
      if (oldP && newP) {
        const pct = Math.abs((newP - oldP) / oldP) * 100;
        return Math.min(100, 85 + Math.round(pct / 5)); // 90+ for meaningful moves
      }
      return 90;
    }
    case 'plan_added':
    case 'plan_removed': return 80;
    case 'shrinkflation': return 85;
    case 'packaging':     return 72;
    case 'copy':          return 45;
    default:              return 20; // cosmetic
  }
}

const validDiff = (o) => o && Array.isArray(o.changes);

/** Returns [] when hash unchanged; otherwise scored change events. */
export async function diffSnapshots(prevNorm, prevHash, nextNorm) {
  const nextHash = hashExtracted(nextNorm);
  if (prevHash && nextHash === prevHash) return { hash: nextHash, changes: [] };
  if (!prevNorm) return { hash: nextHash, changes: [] }; // first snapshot: baseline only

  const { result, engine } = await aiJson(semanticDiff(prevNorm, nextNorm), validDiff, "diff");
  const changes = (result.changes || []).map((c) => ({
    ...c,
    significance: scoreChange(c),
    engine
  }));
  return { hash: nextHash, changes };
}
