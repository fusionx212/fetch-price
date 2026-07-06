// Mirrors the farm's Supabase schema (supabase/schema.sql) and the normalised
// snapshot shape produced by src/diff/diff.js: { plans:[{name,price,currency,period,unit,features[]}] }.

export type Category = 'saas' | 'broadband' | 'telecoms' | 'energy' | 'water';

export interface Vendor {
  id: string;
  name: string;
  slug: string;
  category: Category;
  pricing_url: string;
  currency: string;
  affiliate_url?: string | null;
  affiliate_network?: string | null;
  affiliate_status?: string; // none | applied | approved
}

export interface Plan {
  name: string;
  price: number | null;      // standard/list price; null = "contact sales"
  deal_price?: number | null; // current promo/deal price if lower than list, else null
  deal_note?: string | null;  // short description of the deal
  currency: string;
  period: 'month' | 'year' | 'usage' | string;
  unit: string | null;       // "per seat" | "flat" | "per GB" ...
  features: string[];
}

export interface Snapshot {
  captured_at: string;       // ISO
  extracted: { plans: Plan[] };
}

export type ChangeType =
  | 'price_up' | 'price_down' | 'plan_added' | 'plan_removed'
  | 'shrinkflation' | 'packaging' | 'copy' | 'cosmetic';

export interface ChangeEvent {
  id: string;
  vendor_id: string;
  vendor?: Vendor;           // joined for feed rendering
  plan_name: string | null;
  detected_at: string;       // ISO
  change_type: ChangeType;
  old_value: Partial<Plan> | null;
  new_value: Partial<Plan> | null;
  significance: number;      // 0–100
  summary: string;
}

/** A single point on a plan's price history (derived from snapshots). */
export interface PricePoint { date: string; price: number | null; }
