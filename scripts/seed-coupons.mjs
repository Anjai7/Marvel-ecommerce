/**
 * Seed a handful of real, usable coupons for the storefront.
 *
 * The product page used to advertise codes from `product_offers` copy that
 * did not exist in the coupons table. This inserts a few examples into the
 * same catalogue the admin manages and checkout validates. Re-running it is
 * safe: a code that already exists is left exactly as the admin set it.
 *
 * Credentials come from .env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Plain .env loader so the script works without extra dependencies.
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  const value = match[2].replace(/^["']|["']$/g, "");
  if (!process.env[match[1]]) process.env[match[1]] = value;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, key);

const SAMPLES = [
  { code: "ACCESS5", kind: "percent", value: 5, min_subtotal: 0, max_uses: 0 },
  { code: "BLUSHB5", kind: "percent", value: 5, min_subtotal: 0, max_uses: 0 },
  { code: "SMARTP10", kind: "percent", value: 10, min_subtotal: 5000, max_uses: 0 },
  { code: "LAPTOP10", kind: "percent", value: 10, min_subtotal: 15000, max_uses: 0 },
  { code: "FLAT500", kind: "flat", value: 500, min_subtotal: 2999, max_uses: 100 },
  { code: "FREESHIP", kind: "free_shipping", value: 0, min_subtotal: 999, max_uses: 0 },
];

const { data: existing, error: readError } = await supabase.from("coupons").select("code");
if (readError) throw new Error(`Could not read coupons: ${readError.message}`);

const known = new Set((existing ?? []).map((row) => String(row.code).toUpperCase()));
const missing = SAMPLES.filter((coupon) => !known.has(coupon.code));

if (missing.length === 0) {
  console.log("All sample coupons already exist; nothing to do.");
} else {
  const { error } = await supabase
    .from("coupons")
    .insert(missing.map((coupon) => ({ ...coupon, is_active: true, used_count: 0 })));
  if (error) throw new Error(`Could not insert coupons: ${error.message}`);
  console.log(`Inserted ${missing.length} coupons: ${missing.map((c) => c.code).join(", ")}`);
}
