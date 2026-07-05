// fetch-price nightly run. Invoked by systemd timer / cron on the Hermes farm.
//   node src/index.js            → full run
//   node src/index.js --vendor=notion  → single vendor (debugging)
import 'dotenv/config';
import { dueVendors, lastSnapshot, saveSnapshot, saveEvents, bumpVendor, db } from './db.js';
import { scrapeVendor } from './scraper/cascade.js';
import { normalise, diffSnapshots } from './diff/diff.js';
import { aiText } from './ai/client.js';
import { newsjackDraft } from './ai/prompts.js';
import { tgSend, notifyFlagged, notifyDraft, dailyStatus } from './ops/telegram.js';

const NEWSJACK_THRESHOLD = Number(process.env.NEWSJACK_THRESHOLD || 80);
const HEALTHCHECK_URL = process.env.HEALTHCHECK_URL;
const NETLIFY_BUILD_HOOK = process.env.NETLIFY_BUILD_HOOK;

const stats = { checked: 0, changed: 0, t1: 0, t2: 0, t3: 0, flagged: 0 };

async function processVendor(vendor) {
  stats.checked++;
  try {
    const result = await scrapeVendor(vendor);
    stats[`t${result.tier}`]++;

    const norm = normalise(result.extracted);
    const prev = await lastSnapshot(vendor.id);
    const { hash, changes } = await diffSnapshots(prev?.extracted ?? null, prev?.raw_hash ?? null, norm);

    await saveSnapshot(vendor.id, hash, norm, result.tier);
    await bumpVendor(vendor, { ok: true, selectors: result.selectors });

    if (changes.length) {
      stats.changed += changes.length;
      await saveEvents(vendor.id, changes);
      // Draft newsjack for the biggest change if it clears the bar
      const top = changes.reduce((a, b) => (a.significance >= b.significance ? a : b));
      if (top.significance >= NEWSJACK_THRESHOLD) {
        const { data: ev } = await db.from('fp_change_events')
          .select('id').eq('vendor_id', vendor.id)
          .order('detected_at', { ascending: false }).limit(1).single();
        const { result: draft } = await aiText(newsjackDraft(vendor.name, top));
        await db.from('fp_change_events').update({ newsjack_status: 'drafted' }).eq('id', ev.id);
        await notifyDraft(vendor, ev.id, draft);
      }
    }
  } catch (e) {
    console.error(`[${vendor.slug}] FAILED: ${e.message}`);
    const flagged = await bumpVendor(vendor, { ok: false });
    if (flagged) { stats.flagged++; await notifyFlagged(vendor, e.message); }
  }
}

async function main() {
  const only = process.argv.find((a) => a.startsWith('--vendor='))?.split('=')[1];
  let vendors = await dueVendors();
  if (only) vendors = vendors.filter((v) => v.slug === only);
  console.log(`Run start: ${vendors.length} vendors due`);

  // Sequential with polite pacing — one page per vendor per day needs no concurrency
  for (const v of vendors) {
    await processVendor(v);
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (stats.changed && NETLIFY_BUILD_HOOK) {
    await fetch(NETLIFY_BUILD_HOOK, { method: 'POST' }).catch(() => {});
  }
  if (HEALTHCHECK_URL) await fetch(HEALTHCHECK_URL).catch(() => {});
  await dailyStatus(stats);
  console.log('Run complete', stats);
}

main().catch(async (e) => {
  console.error('RUN FAILED', e);
  await tgSend(`🔥 Fetch-Price run crashed: ${e.message}`);
  process.exit(1);
});
