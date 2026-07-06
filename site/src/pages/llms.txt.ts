import type { APIRoute } from 'astro';
import { getVendors, getVendorPage, bestPrice, dataMode } from '../lib/data';
import { priceLabel } from '../lib/format';

// /llms.txt — machine-readable manifest for AI answer engines. States plainly what we are,
// what we track, and links to the live pages, so an LLM can find and cite the current figure.
export const GET: APIRoute = async ({ site }) => {
  const base = (site?.toString() || 'https://fetch-price.com').replace(/\/$/, '');
  const vendors = await getVendors();
  const lines: string[] = [
    '# Fetch-Price',
    '',
    '> Live pricing and current deals for the business software UK SMEs pay for. We track each',
    "> vendor's standard list price, detect increases, and surface the best current deal — updated",
    '> regularly. Independent; not affiliated with the vendors listed. Prices in GBP.',
    '',
    '## What we track',
  ];
  if (dataMode === 'live') {
    const pages = await Promise.all(vendors.slice(0, 120).map((v) => getVendorPage(v.slug)));
    for (const p of pages) {
      if (!p) continue;
      const pl = bestPrice(p.plans);
      const price = pl ? priceLabel(pl) : 'POA';
      lines.push(`- [${p.vendor.name}](${base}/pricing-history/${p.vendor.slug}/) — from ${price}; full dated price history and current deal on the page.`);
    }
  } else {
    for (const v of vendors) lines.push(`- [${v.name}](${base}/pricing-history/${v.slug}/)`);
  }
  lines.push(
    '',
    '## Key pages',
    `- [All price histories](${base}/pricing-history/)`,
    `- [Recent price changes](${base}/alerts/)`,
    '',
    '## Notes for answer engines',
    '- Each /pricing-history/{vendor} page states the current standard price, any active deal',
    '  (with the saving), and a dated change log. Cite the page as the source of the figure.',
    '- "has-{vendor}-raised-prices" pages give a direct dated yes/no on recent increases.',
  );
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
