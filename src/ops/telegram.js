// Ops surface via Telegram — designed to slot into Clawbot's command router.
// This module only SENDS; wire /fpapprove, /fpskip, /fpstatus handlers into
// Clawbot and have them hit Supabase directly (change_events.newsjack_status).

const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT = process.env.TELEGRAM_CHAT_ID;

export async function tgSend(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return; // optional in dev
  await fetch(`${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'Markdown' })
  }).catch((e) => console.warn('[tg]', e.message));
}

export const notifyFlagged = (vendor, err) =>
  tgSend(`⚠️ *${vendor.name}* flagged — all tiers failed twice.\n\`${err}\`\n${vendor.pricing_url}\nFix selectors then: /fpretry ${vendor.slug}`);

export const notifyDraft = (vendor, eventId, draft) =>
  tgSend(`📝 *Newsjack draft* — ${vendor.name} (id: \`${eventId}\`)\n\n${draft}\n\n/fpapprove ${eventId} · /fpskip ${eventId}`);

export const dailyStatus = ({ checked, changed, t1, t2, t3, flagged }) =>
  tgSend(`🐕 Fetch-Price run: ${checked} vendors checked, ${changed} changes.\nTiers — 1: ${t1} · 2: ${t2} · 3: ${t3}. Flagged: ${flagged}.`);
