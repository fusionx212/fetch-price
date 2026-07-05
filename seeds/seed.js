// One-off: node seeds/seed.js
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { db } from '../src/db.js';

const vendors = JSON.parse(readFileSync(new URL('./vendors.json', import.meta.url)));
const { error } = await db.from('fp_vendors').upsert(vendors, { onConflict: 'slug' });
if (error) throw error;
console.log(`Seeded ${vendors.length} vendors.`);
