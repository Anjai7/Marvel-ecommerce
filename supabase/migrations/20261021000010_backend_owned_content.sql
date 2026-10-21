-- ====================================================
-- BACKEND-OWNED CONTENT
--
-- Contract: docs/superpowers/specs/2026-10-21-backend-owned-content.md
--
-- Additive and re-runnable. Every table is created IF NOT EXISTS, every
-- column is added IF NOT EXISTS, every index is created IF NOT EXISTS and
-- every policy is dropped before it is created. No DROP TABLE, TRUNCATE or
-- DELETE statement appears in this file.
--
-- Contents:
--   1. site_settings   (key -> JSONB value, public read)
--   2. product_offers  (emi / bank / coupon rows per product)
--   3. product_reviews (stored review rows, one per reviewer)
--   4. product_variants(color / size rows per product)
--   5. product_media   (hero / gallery / thumb rows per product)
--   6. wishlist        (per-user rows, service role only)
--   7. products        (nullable content columns; NULL means "not configured")
--   8. indexes, RLS and the updated_at trigger for site_settings
-- ====================================================

-- ─── 1. site_settings ───
-- `value` is the stored JSON value; the API returns `key -> value` as a flat
-- map and omits a key that has no row. A row whose value is JSON `null` is a
-- configured key with no value, which the API passes through as null.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  group_name text not null default 'general',
  updated_at timestamptz not null default timezone('utc', now())
);

-- ─── 2. product_offers ───
-- `kind` is the surface selector: an EMI plan, a bank offer or a coupon.
-- `months`/`amount`/`interest` are only meaningful for an EMI row.
create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('emi', 'bank', 'coupon')),
  title text,
  bank text,
  code text,
  description text,
  months int,
  amount numeric,
  interest text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

-- ─── 3. product_reviews ───
-- The rating summary is always aggregated from these rows, never read from
-- products.rating.
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_name text not null,
  author_avatar text,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- ─── 4. product_variants ───
-- Colours and sizes share one table; `kind` groups them. `value` carries the
-- swatch hex for a colour and the label of the selectable option for a size.
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('color', 'size')),
  label text not null,
  value text,
  position int not null default 0,
  is_active boolean not null default true
);

-- ─── 5. product_media ───
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  kind text not null default 'gallery' check (kind in ('gallery', 'hero', 'thumb')),
  position int not null default 0,
  is_active boolean not null default true
);

-- ─── 6. wishlist ───
-- `unique (user_id, product_id)` is what makes POST idempotent. The Express
-- route always writes the caller's own id as `user_id`.
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);

-- ─── 7. products content columns ───
-- Every column is nullable and has no default: a null means "not configured",
-- and the API/frontend must render nothing rather than invent a value.
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists offer_text text;
alter table public.products add column if not exists offer_ends_at timestamptz;
alter table public.products add column if not exists warranty text;
alter table public.products add column if not exists highlights jsonb;
alter table public.products add column if not exists specifications jsonb;
alter table public.products add column if not exists dimensions jsonb;
alter table public.products add column if not exists materials jsonb;
alter table public.products add column if not exists care_instructions jsonb;
alter table public.products add column if not exists certifications jsonb;
alter table public.products add column if not exists in_box jsonb;
alter table public.products add column if not exists delivery_info jsonb;
alter table public.products add column if not exists user_guide jsonb;

-- ─── 8. Indexes ───
-- The detail route reads each child table by product, filters active rows and
-- orders by position.
create index if not exists product_offers_product_position
  on public.product_offers (product_id, position);
create index if not exists product_reviews_product_created
  on public.product_reviews (product_id, created_at desc);
create index if not exists product_variants_product_position
  on public.product_variants (product_id, position);
create index if not exists product_media_product_position
  on public.product_media (product_id, position);
create index if not exists wishlist_user_created
  on public.wishlist (user_id, created_at desc);

-- ─── 9. Row Level Security ───
-- The storefront reads through Express with the service role, which bypasses
-- RLS. Anonymous direct reads are still allowed for the public content tables
-- so a client can never see a disabled row, and are denied entirely for the
-- wishlist (it is per-user data and has no public read).

alter table public.site_settings enable row level security;
drop policy if exists "Public read site_settings" on public.site_settings;
create policy "Public read site_settings" on public.site_settings
  for select to anon, authenticated using (true);
drop policy if exists "Service role full access on site_settings" on public.site_settings;
create policy "Service role full access on site_settings" on public.site_settings
  for all to service_role using (true);

alter table public.product_offers enable row level security;
drop policy if exists "Public read active product_offers" on public.product_offers;
create policy "Public read active product_offers" on public.product_offers
  for select to anon, authenticated using (is_active = true);
drop policy if exists "Service role full access on product_offers" on public.product_offers;
create policy "Service role full access on product_offers" on public.product_offers
  for all to service_role using (true);

alter table public.product_reviews enable row level security;
drop policy if exists "Public read product_reviews" on public.product_reviews;
create policy "Public read product_reviews" on public.product_reviews
  for select to anon, authenticated using (true);
drop policy if exists "Service role full access on product_reviews" on public.product_reviews;
create policy "Service role full access on product_reviews" on public.product_reviews
  for all to service_role using (true);

alter table public.product_variants enable row level security;
drop policy if exists "Public read active product_variants" on public.product_variants;
create policy "Public read active product_variants" on public.product_variants
  for select to anon, authenticated using (is_active = true);
drop policy if exists "Service role full access on product_variants" on public.product_variants;
create policy "Service role full access on product_variants" on public.product_variants
  for all to service_role using (true);

alter table public.product_media enable row level security;
drop policy if exists "Public read active product_media" on public.product_media;
create policy "Public read active product_media" on public.product_media
  for select to anon, authenticated using (is_active = true);
drop policy if exists "Service role full access on product_media" on public.product_media;
create policy "Service role full access on product_media" on public.product_media
  for all to service_role using (true);

alter table public.wishlist enable row level security;
drop policy if exists "Service role full access on wishlist" on public.wishlist;
create policy "Service role full access on wishlist" on public.wishlist
  for all to service_role using (true);

-- ─── 10. updated_at trigger for site_settings ───
-- set_updated_at() already exists (20261020000007). DROP TRIGGER before CREATE
-- TRIGGER keeps this file re-runnable.
drop trigger if exists trg_set_updated_at on public.site_settings;
create trigger trg_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
