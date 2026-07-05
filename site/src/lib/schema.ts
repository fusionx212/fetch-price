// Schema.org JSON-LD builders. Every plan carries PriceSpecification (spec §3).
import type { Vendor, Plan, ChangeEvent } from './types';
import { fullDate } from './format';

export function productSchema(vendor: Vendor, plans: Plan[], site: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${vendor.name} pricing`,
    category: vendor.category,
    url: `${site}/pricing-history/${vendor.slug}/`,
    brand: { '@type': 'Brand', name: vendor.name },
    offers: plans.filter((p) => typeof p.price === 'number').map((p) => ({
      '@type': 'Offer',
      name: p.name,
      priceCurrency: p.currency,
      price: p.price,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: p.price,
        priceCurrency: p.currency,
        unitText: p.unit ?? 'flat',
        billingIncrement: 1,
        referenceQuantity: { '@type': 'QuantitativeValue', unitText: p.period },
      },
    })),
  };
}

export function breadcrumb(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: it.url,
    })),
  };
}

export function faqSchema(qas: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map((x) => ({
      '@type': 'Question', name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.a },
    })),
  };
}

/** For /has-{vendor}-raised-prices — an evidenced yes/no answer. */
export function raisedPricesFAQ(vendor: Vendor, events: ChangeEvent[]) {
  const rises = events.filter((e) => e.change_type === 'price_up');
  const answer = rises.length
    ? `Yes. We have recorded ${rises.length} price ${rises.length === 1 ? 'rise' : 'rises'} for ${vendor.name}. The most recent was on ${fullDate(rises[0].detected_at)}: ${rises[0].summary}`
    : `Not in the period we have tracked. We have no recorded list-price rise for ${vendor.name} to date, and we check regularly.`;
  return faqSchema([{ q: `Has ${vendor.name} raised its prices?`, a: answer }]);
}
