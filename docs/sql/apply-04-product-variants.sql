-- ====================================================
-- APPLY BUNDLE 04 — PRODUCT OPTIONS AND VARIANTS
--
-- WHAT: the product options / variants schema:
--   1. product_option_values       (the shared catalogue of option values)
--   2. product_variants            (widened: eight kinds + option_value_id)
--   3. product_variant_combinations (the sellable combinations)
--   4. the backfill of the catalogue from the existing product_variants rows
--   5. indexes, RLS policies and the verification queries
--
-- WHERE: the Supabase SQL Editor (or psql) against the project that already
-- has apply-01-content-taxonomy.sql applied.
--
-- THIS FILE IS NOT APPLIED FROM THIS MACHINE. The human partner runs it.
--
-- Safe to re-run: every table is created IF NOT EXISTS, the widened `kind`
-- check is dropped before it is added, the new column is added IF NOT EXISTS
-- and the backfill is an idempotent upsert. Pasting the file twice changes
-- nothing the second time.
--
-- Contract: docs/product-variants-contract.md
-- ====================================================


-- ====================================================
-- PART 1 — THE SCHEMA
-- ====================================================

-- ─── 1. product_option_values (the shared catalogue) ───
-- One row per (kind, label) in the whole store. The product row links to it
-- through `product_variants.option_value_id`, so renaming the catalogue row
-- renames the option everywhere that links to it — that is the whole point
-- of the table.
--
-- `value` is the machine value (a hex for a colour, otherwise free text and
-- often the same as the label). It is nullable: a catalogue entry may name a
-- choice without carrying a machine value.
--
-- The unique (kind, label) is what makes the backfill an upsert, and what
-- stops two products from drifting apart on the same axis.

CREATE TABLE IF NOT EXISTS public.product_option_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('color','size','capacity','storage','material','style','weight','flavour')),
    label TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (kind, label)
);

-- ─── 2. product_variants (the option values of a product) ───
-- The table already exists with `kind in ('color','size')` only. The kind
-- check is widened to the eight kinds the contract allows, and the link to
-- the catalogue is added.
--
-- The CREATE TABLE below is a no-op on a database that already has the table
-- (it is there for a database that has not had
-- 20261021000010_backend_owned_content.sql applied); the ALTER statements are
-- what actually widen the existing table.

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('color','size','capacity','storage','material','style','weight','flavour')),
    label TEXT NOT NULL,
    value TEXT,
    option_value_id UUID REFERENCES public.product_option_values(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- The inline CHECK of the original CREATE TABLE is named
-- `product_variants_kind_check`. Dropping it first and adding the widened
-- one keeps this file re-runnable: a second run drops the constraint it
-- added the first time and adds it again.

ALTER TABLE public.product_variants
    DROP CONSTRAINT IF EXISTS product_variants_kind_check;
ALTER TABLE public.product_variants
    ADD CONSTRAINT product_variants_kind_check
    CHECK (kind IN ('color','size','capacity','storage','material','style','weight','flavour'));

-- `on delete set null` and not `cascade`: deleting a catalogue entry must
-- not delete the product's option row, it must only unlink it. The product
-- row keeps its own label and value and simply stops following renames.

ALTER TABLE public.product_variants
    ADD COLUMN IF NOT EXISTS option_value_id UUID REFERENCES public.product_option_values(id) ON DELETE SET NULL;

-- ─── 3. product_variant_combinations (the sellable variants) ───
-- One row per combination the customer can buy: "Blue / M" with its own
-- price, stock and SKU.
--
-- `options` is a jsonb array of `{ kind, label, value }` — the choice this
-- combination represents. It is a snapshot, not a link: the rows of the
-- combination keep the values that were chosen when it was created.

CREATE TABLE IF NOT EXISTS public.product_variant_combinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT,
    price NUMERIC,
    stock INT,
    image_url TEXT,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    position INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- ====================================================
-- PART 2 — THE BACKFILL
-- ====================================================

-- ─── 4. Give every existing option value a catalogue row ───
-- The rows of `product_variants` that are already in the store become the
-- first entries of the catalogue, so the admin form can link to them.
--
-- Two details make this safe to run twice:
--
--   * `on conflict (kind, label) do update set value = excluded.value`
--     turns the insert into an upsert: a second run updates the existing
--     catalogue row instead of creating a second one.
--
--   * Only the product rows that are NOT linked yet are read. A catalogue
--     row that an admin renamed keeps its link, so re-running the bundle can
--     never undo a rename by re-creating the old label.
--
-- `distinct on` picks one row per (kind, label) — two products may use the
-- same choice with different machine values, and the catalogue keeps the
-- first one (lowest id) so the result does not depend on the scan order.

INSERT INTO public.product_option_values (kind, label, value)
SELECT DISTINCT ON (v.kind, v.label) v.kind, v.label, v.value
FROM public.product_variants v
WHERE v.option_value_id IS NULL
  AND btrim(v.label) <> ''
ORDER BY v.kind, v.label, v.id
ON CONFLICT (kind, label) DO UPDATE SET value = excluded.value;

-- ─── 5. Point the product rows at their catalogue row ───
-- Only rows without a link are written, for the same reason as above: a
-- renamed catalogue row must keep the link it already has.

UPDATE public.product_variants v
SET option_value_id = c.id
FROM public.product_option_values c
WHERE v.option_value_id IS NULL
  AND c.kind = v.kind
  AND c.label = v.label;

-- ====================================================
-- PART 3 — INDEXES AND RLS
-- ====================================================

-- ─── 6. Indexes ───
-- The detail route reads each child table by product, filters the active
-- rows and orders by position; the catalogue is read by id.

CREATE INDEX IF NOT EXISTS product_variants_product_position
    ON public.product_variants (product_id, position);
CREATE INDEX IF NOT EXISTS product_variants_option_value_id
    ON public.product_variants (option_value_id);
CREATE INDEX IF NOT EXISTS product_variant_combinations_product_position
    ON public.product_variant_combinations (product_id, position);

-- ─── 7. Row Level Security ───
-- The storefront reads through Express with the service role, which bypasses
-- RLS. Anonymous direct reads are allowed for the public content tables so a
-- client can never see a disabled row, and are denied entirely for rows that
-- are not public content.
--
-- `product_option_values` has no `is_active` column: the catalogue is
-- reference data, and every row of it is public.

ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product_option_values" ON public.product_option_values;
CREATE POLICY "Public read product_option_values" ON public.product_option_values
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Service role full access on product_option_values" ON public.product_option_values;
CREATE POLICY "Service role full access on product_option_values" ON public.product_option_values
    FOR ALL TO service_role USING (true);

ALTER TABLE public.product_variant_combinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active product_variant_combinations" ON public.product_variant_combinations;
CREATE POLICY "Public read active product_variant_combinations" ON public.product_variant_combinations
    FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on product_variant_combinations" ON public.product_variant_combinations;
CREATE POLICY "Service role full access on product_variant_combinations" ON public.product_variant_combinations
    FOR ALL TO service_role USING (true);


-- ====================================================
-- VERIFICATION — run these after the script succeeds.
-- Expected results are written next to each query.
-- ====================================================

-- 1. Expected: both new tables exist.
SELECT to_regclass('public.product_option_values'),
       to_regclass('public.product_variant_combinations');

-- 2. Expected: the widened check constraint, with all eight kinds.
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.product_variants'::regclass
  AND conname = 'product_variants_kind_check';

-- 3. Expected: the new column exists and points at the catalogue.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_variants'
  AND column_name = 'option_value_id';

-- 4. Expected: one catalogue row per (kind, label) — never a duplicate.
SELECT kind, count(*), count(DISTINCT label) FROM public.product_option_values
GROUP BY kind ORDER BY kind;

-- 5. Expected 0: every option value with a label is linked to the catalogue.
SELECT count(*) FROM public.product_variants v
WHERE v.option_value_id IS NULL
  AND btrim(v.label) <> '';

-- 6. Expected: the same count as the catalogue rows that came from the
--    backfill — every product row finds its catalogue row.
SELECT count(*) AS product_option_rows,
       count(v.option_value_id) AS linked_rows
FROM public.product_variants v;

-- 7. Expected 0: no combination carries an option outside the eight kinds.
SELECT count(*) FROM public.product_variant_combinations c
CROSS JOIN LATERAL jsonb_array_elements(c.options) AS entry
WHERE entry->>'kind' NOT IN ('color','size','capacity','storage','material','style','weight','flavour');
