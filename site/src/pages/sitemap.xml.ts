import type { APIRoute } from 'astro';
import { getVendors } from '../lib/data';
import { BUYING_GUIDES } from '../lib/buying-guides';

export const GET: APIRoute = async ({ site }) => {
  const base = (site?.toString() || 'https://fetch-price.com').replace(/\/$/, '');
  const vendors = await getVendors();
  const now = new Date().toISOString().slice(0, 10);
  const urls = [
    { u: '', p: '1.0' },
    { u: 'pricing-history/', p: '0.9' },
    { u: 'alerts/', p: '0.8' },
    { u: 'best/', p: '0.9' },
    ...BUYING_GUIDES.map((g) => ({ u: `best/${g.slug}/`, p: '0.85' })),
    ...vendors.flatMap((v) => [
      { u: `pricing-history/${v.slug}/`, p: '0.8' },
      { u: `has-${v.slug}-raised-prices/`, p: '0.6' },
    ]),
  ];
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((x) => `  <url><loc>${base}/${x.u}</loc><lastmod>${now}</lastmod><priority>${x.p}</priority></url>`)
      .join('\n') +
    `\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
