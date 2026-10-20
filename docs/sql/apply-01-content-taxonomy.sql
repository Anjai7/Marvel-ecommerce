-- ====================================================
-- APPLY BUNDLE 01 — CONTENT TAXONOMY, BANNERS AND FOOTER
--
-- WHAT: the full contents of
--   supabase/migrations/20261020000007_content_taxonomy.sql
--   supabase/migrations/20261020000008_seed_categories.sql
-- in that order, concatenated into one paste-ready script.
--
-- WHERE: the Supabase SQL Editor (or psql) against the project that already
-- has 20261020000006_password_reset_tokens.sql applied.
--
-- THIS FILE IS NOT APPLIED FROM THIS MACHINE. The human partner runs it.
--
-- Safe to re-run: every object is created IF NOT EXISTS, every policy is
-- dropped before it is created, the seed inserts use ON CONFLICT DO NOTHING
-- and the backfills are idempotent.
--
-- `site_categories` is NOT dropped here. The storefront still reads it until
-- the replacement API ships; the drop is the separate bundle
-- docs/sql/apply-02-drop-site-categories.sql.
-- ====================================================




-- ====================================================
-- PART 1 OF 2 — supabase/migrations/20261020000007_content_taxonomy.sql
-- ====================================================

-- ====================================================
-- DYNAMIC SITE CONTENT: TAXONOMY + BANNERS + FOOTER
-- Additive-only migration: new tables, new columns, indexes,
-- scoped RLS policies and the updated_at trigger.
-- No DROP TABLE / TRUNCATE / DELETE statements in this file.
--
-- Contents (spec §3, §9.1):
--   1. categories                (3-level taxonomy, self FK)
--   2. products.category_id      (+ index)
--   3. menu_items.category_id
--   4. promo_banners             (home banner layout / carousel / strip)
--   5. footer_sections           (footer columns + popular searches)
--   6. footer_links              (links and tags per section)
--   7. RLS                       (public read of active rows, service_role writes)
--   8. set_updated_at()          (+ trigger on the five content tables)
--
-- Re-runnable: every object is created IF NOT EXISTS and every policy
-- is dropped before it is created.
-- ====================================================

-- ─── 1. categories (single source of truth for the taxonomy) ───
-- `level` is stored, not derived: 1 = category, 2 = subcategory, 3 = leaf.
-- `slug` is only the LAST path segment; the full path is rebuilt by walking
-- parent_id, so a bare slug is deliberately not an identifier.
-- Root slugs are globally unique, child slugs are unique among their siblings.

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    description TEXT,
    icon TEXT,
    image_url TEXT,
    banner_image_url TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    show_in_nav BOOLEAN NOT NULL DEFAULT true,
    show_in_homepage BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_root_unique
    ON public.categories (slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_child_unique
    ON public.categories (parent_id, slug) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS categories_parent_order
    ON public.categories (parent_id, display_order);
CREATE INDEX IF NOT EXISTS categories_active_order
    ON public.categories (is_active, display_order);

-- ─── 2. products.category_id ───
-- `products.category` stays: it is the NOT NULL free-text display label that
-- the product cards and the legacy ?category= filter read. `category_id` is
-- the binding used for taxonomy filtering and for the category relationship.

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_category_id_idx
    ON public.products (category_id);

-- ─── 3. menu_items.category_id ───
-- A menu row may point at a taxonomy row. The mega-menu rows point at the
-- category with the same id; the six legacy flat navigation rows keep NULL.

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- ─── 4. promo_banners ───
-- `placement` is the surface selector and never changes meaning. Fields a
-- placement does not use are stored anyway and ignored by the storefront.
-- `display_order` is scoped per placement (one reorder scope per surface).

CREATE TABLE IF NOT EXISTS public.promo_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placement TEXT NOT NULL CHECK (placement IN ('home_banner_layout','home_promo_carousel','promo_strip')),
    variant TEXT NOT NULL DEFAULT 'standard',
    badge TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    highlight TEXT,
    description TEXT,
    cta_text TEXT,
    cta_path TEXT,
    image_url TEXT,
    bg_image_url TEXT,
    fallback_image_url TEXT,
    bg_gradient TEXT,
    emoji TEXT,
    code TEXT,
    accent TEXT,
    bg_color TEXT,
    gallery TEXT[] NOT NULL DEFAULT '{}',
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS promo_banners_placement_order
    ON public.promo_banners (placement, display_order);

-- ─── 5. footer_sections ───
-- `section_type = 'links'` is a column of anchors; 'tags' is the
-- popular-search chip block. `column_index` picks the visual column and is
-- independent of `display_order`.

CREATE TABLE IF NOT EXISTS public.footer_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    heading TEXT NOT NULL,
    section_type TEXT NOT NULL DEFAULT 'links' CHECK (section_type IN ('links','tags')),
    column_index INT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 6. footer_links ───
-- Deleting a section cascades to its links.

CREATE TABLE IF NOT EXISTS public.footer_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.footer_sections(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    href TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS footer_links_section_order
    ON public.footer_links (section_id, display_order);

-- ─── 7. Row Level Security ───
-- Public (anon + authenticated) may SELECT active rows only.
-- Writes are scoped to service_role, which is the only role the Express
-- server uses. Never add an unscoped `FOR ALL USING (true)` here: that is the
-- pre-existing bug on products/orders (20260822000002) and must not spread.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
CREATE POLICY "Public read active categories" ON public.categories
    FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on categories" ON public.categories;
CREATE POLICY "Service role full access on categories" ON public.categories
    FOR ALL TO service_role USING (true);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active promo_banners" ON public.promo_banners;
CREATE POLICY "Public read active promo_banners" ON public.promo_banners
    FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on promo_banners" ON public.promo_banners;
CREATE POLICY "Service role full access on promo_banners" ON public.promo_banners
    FOR ALL TO service_role USING (true);

ALTER TABLE public.footer_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active footer_sections" ON public.footer_sections;
CREATE POLICY "Public read active footer_sections" ON public.footer_sections
    FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on footer_sections" ON public.footer_sections;
CREATE POLICY "Service role full access on footer_sections" ON public.footer_sections
    FOR ALL TO service_role USING (true);

ALTER TABLE public.footer_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active footer_links" ON public.footer_links;
CREATE POLICY "Public read active footer_links" ON public.footer_links
    FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on footer_links" ON public.footer_links;
CREATE POLICY "Service role full access on footer_links" ON public.footer_links
    FOR ALL TO service_role USING (true);

-- hero_slides already exists (20261016000006) with its public-read policy.
-- It gains the same scoped service-role policy so the generic CRUD factory can
-- write it, and so the §9.2 gate shows {service_role} on every FOR ALL policy.
DROP POLICY IF EXISTS "Service role full access on hero_slides" ON public.hero_slides;
CREATE POLICY "Service role full access on hero_slides" ON public.hero_slides
    FOR ALL TO service_role USING (true);

-- ─── 8. updated_at trigger ───
-- One function, attached to every content table. The trigger overwrites any
-- client-supplied updated_at; the API never writes that column.
-- DROP TRIGGER before CREATE TRIGGER keeps this file re-runnable.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.categories;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.promo_banners;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.promo_banners
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.footer_sections;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.footer_sections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.footer_links;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.footer_links
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- hero_slides keeps no display_order column (§3.6): it still orders by
-- order_index, so only the trigger and the policy change here.
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.hero_slides;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.hero_slides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ====================================================
-- PART 2 OF 2 — supabase/migrations/20261020000008_seed_categories.sql
-- ====================================================

-- ====================================================
-- SEED THE CATEGORY TAXONOMY FROM THE MENU TREE
-- The category id IS the menu item id, so `menu_items.category_id`
-- is an exact link and re-running this file is a no-op.
--
-- Re-runnable: ON CONFLICT DO NOTHING plus idempotent UPDATEs.
-- No DROP TABLE / TRUNCATE / DELETE statement in this file.
--
-- Order matters. The three INSERTs run level by level because a single
-- INSERT ... SELECT gives no row-ordering guarantee and the self-referencing
-- parent_id foreign key is IMMEDIATE, not deferred: a level-2 row must find
-- its level-1 parent already present.
--
-- Only the mega-menu rows are taxonomy. `menu_items` also holds six legacy
-- flat navigation rows seeded by 20260822000000_init_schema.sql:143-151
-- (Home & Shop, Electronics & Tech, Fashion & Lifestyle, Vendor Portal,
-- Admin Panel, Super Admin System). They are level 1 with parent_id NULL and
-- are NOT categories: selecting them would collide with the root slug
-- `electronics`, produce an empty slug from the `/` path, and turn the three
-- dashboard entries into categories. The fixed-id prefixes d1c/d2c/d3c from
-- 20261016000006 are the discriminator.
--
-- The slug is the LAST path segment. Do not use split_part(): split_part(x,
-- '/', n) returns the empty string when the path has fewer than n segments,
-- which is every level-1 and level-2 row. The `^.*/` regexp strips everything
-- up to and including the final slash, so it is correct at every depth:
--   /category/electronics                            -> electronics
--   /category/electronics/mobiles                       -> mobiles
--   /category/electronics/mobiles/smartphones           -> smartphones
-- ====================================================

-- ─── 1. Level-1 roots ───
-- COALESCE is required: menu_items.order_index and menu_items.is_active are
-- nullable while categories.display_order and categories.is_active are NOT NULL.

INSERT INTO public.categories (id, name, slug, parent_id, level, display_order, is_active, show_in_nav, show_in_homepage)
SELECT m.id,
       m.title,
       lower(regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')),
       NULL,
       1,
       COALESCE(m.order_index, 0),
       COALESCE(m.is_active, true),
       true,
       true
FROM public.menu_items m
WHERE m.id::text LIKE 'd1c%' AND m.level = 1
ON CONFLICT DO NOTHING;

-- ─── 2. Level-2 subcategories (parents are the level-1 rows above) ───

INSERT INTO public.categories (id, name, slug, parent_id, level, display_order, is_active, show_in_nav, show_in_homepage)
SELECT m.id,
       m.title,
       lower(regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')),
       m.parent_id,
       2,
       COALESCE(m.order_index, 0),
       COALESCE(m.is_active, true),
       true,
       false
FROM public.menu_items m
WHERE m.id::text LIKE 'd2c%' AND m.level = 2
ON CONFLICT DO NOTHING;

-- ─── 3. Level-3 leaves (parents are the level-2 rows above) ───

INSERT INTO public.categories (id, name, slug, parent_id, level, display_order, is_active, show_in_nav, show_in_homepage)
SELECT m.id,
       m.title,
       lower(regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')),
       m.parent_id,
       3,
       COALESCE(m.order_index, 0),
       COALESCE(m.is_active, true),
       true,
       false
FROM public.menu_items m
WHERE m.id::text LIKE 'd3c%' AND m.level = 3
ON CONFLICT DO NOTHING;

-- ─── 4. Count guard ───
-- Abort instead of applying a corrupted tree. The expected counts are read
-- from the LIVE menu_items seed, not hard-coded, so the guard stays correct
-- when the mega-menu seed grows. The three checks are independent:
--   * per-level counts catch a dropped, duplicated or wrong-depth insert;
--   * orphan_count catches a row whose parent insert failed;
--   * empty_slug_count catches a row whose path had no last segment.

DO $$
DECLARE
  expected_roots INT; expected_l2 INT; expected_l3 INT;
  actual_roots INT; actual_l2 INT; actual_l3 INT; orphan_count INT; empty_slug_count INT;
BEGIN
  SELECT count(*) FILTER (WHERE id::text LIKE 'd1c%'),
         count(*) FILTER (WHERE id::text LIKE 'd2c%'),
         count(*) FILTER (WHERE id::text LIKE 'd3c%')
    INTO expected_roots, expected_l2, expected_l3
    FROM public.menu_items;

  SELECT count(*) FILTER (WHERE level = 1),
         count(*) FILTER (WHERE level = 2),
         count(*) FILTER (WHERE level = 3)
    INTO actual_roots, actual_l2, actual_l3
    FROM public.categories
   WHERE id::text LIKE 'd1c%' OR id::text LIKE 'd2c%' OR id::text LIKE 'd3c%';

  SELECT count(*) INTO orphan_count
    FROM public.categories
   WHERE level > 1 AND parent_id IS NULL;

  SELECT count(*) INTO empty_slug_count
    FROM public.categories
   WHERE slug IS NULL OR slug = '';

  IF actual_roots <> expected_roots
     OR actual_l2 <> expected_l2
     OR actual_l3 <> expected_l3 THEN
    RAISE EXCEPTION 'categories seed mismatch: expected %/%/%, got %/%/%',
      expected_roots, expected_l2, expected_l3, actual_roots, actual_l2, actual_l3;
  END IF;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'categories seed produced % orphan rows above level 1', orphan_count;
  END IF;

  IF empty_slug_count > 0 THEN
    RAISE EXCEPTION 'categories seed produced % rows with an empty slug', empty_slug_count;
  END IF;
END $$;

-- ─── 5. Link the menu rows back to their category ───
-- Exact by id: only taxonomy rows have a category with the same id, so the six
-- legacy flat rows keep category_id IS NULL by construction.

UPDATE public.menu_items m
SET category_id = c.id
FROM public.categories c
WHERE c.id = m.id;

-- ─── 6. The homepage category strip ───
-- This UPDATE owns show_in_homepage and overrides the value the three inserts
-- wrote. The seven names are the verified seeded level-1 roots; note that the
-- seeded root is `Sports`, not "Sports & Fitness". Renaming a root in the
-- mega-menu seed means editing this list too.

UPDATE public.categories
SET show_in_homepage = (
  level = 1 AND name IN (
    'Electronics', 'Fashion', 'Home & Kitchen', 'Beauty',
    'Sports', 'Toys & Baby', 'Accessories'
  )
);

-- ─── 7. Copy the legacy category imagery by name ───
-- Case-insensitive exact name match. Only 7 of the 10 legacy site_categories
-- names exist in the taxonomy (Mobiles, Laptops, Headphones, Watches, Bags,
-- Cameras, Gaming); TVs, Shoes and Perfumes match nothing.
--
-- Guarded on the table existing: apply-02 drops site_categories, and this file
-- must stay re-runnable after that drop. On a fresh database the table exists
-- and the backfill runs exactly as spec §7.1 describes.

DO $$
BEGIN
  IF to_regclass('public.site_categories') IS NOT NULL THEN
    UPDATE public.categories c
    SET image_url = s.image_url
    FROM public.site_categories s
    WHERE lower(s.name) = lower(c.name)
      AND c.image_url IS NULL;
  END IF;
END $$;

-- ─── 8. Deterministic image fallbacks ───
-- Whatever the name match above did not fill gets a per-root Unsplash image,
-- so no category tile renders broken. These are the same URLs already used by
-- the static storefront assets, which keeps them known-good.
-- Root slug -> image, for every level below that root.

WITH RECURSIVE category_tree AS (
    SELECT id AS root_id, id AS category_id
    FROM public.categories
    WHERE parent_id IS NULL
    UNION ALL
    SELECT t.root_id, c.id
    FROM public.categories c
    JOIN category_tree t ON c.parent_id = t.category_id
),
root_fallbacks (root_slug, image_url) AS (
    VALUES
      ('electronics',      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=600&fit=crop&q=80'),
      ('fashion',          'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=600&fit=crop&q=80'),
      ('home-and-kitchen', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop&q=80'),
      ('beauty',           'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=600&fit=crop&q=80'),
      ('sports',           'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop&q=80'),
      ('toys-and-baby',    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=600&fit=crop&q=80'),
      ('accessories',      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop&q=80')
)
UPDATE public.categories c
SET image_url = f.image_url
FROM category_tree t
JOIN public.categories root ON root.id = t.root_id
JOIN root_fallbacks f ON f.root_slug = root.slug
WHERE c.id = t.category_id
  AND c.image_url IS NULL;

-- Anything still NULL (for example a root created by an admin under a slug the
-- mapping above does not know) gets the neutral product fallback rather than a
-- broken tile.
UPDATE public.categories
SET image_url = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop&q=80'
WHERE image_url IS NULL;

-- ─── 9. Bind existing products to the taxonomy ───
-- `products.category` is a free-text display label, so the match is by name.
-- The three-key tiebreak (level, then display_order, then id) makes an
-- ambiguous name bind to exactly one row: `Ethnic Wear` exists at level 3
-- under both Men's and Women's Fashion, and `Accessories` exists three times.
-- `LIMIT 1` in the subquery guarantees a single id per product.
--
-- Only rows with no binding yet are touched. On the first apply every product
-- has category_id NULL, so this behaves exactly as spec §7.1 describes; on a
-- re-run it leaves the product seed's deliberate per-category bindings alone
-- instead of collapsing them onto the lowest-level name match.

UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND c.id = (
    SELECT c2.id
    FROM public.categories c2
    WHERE lower(c2.name) = lower(p.category)
    ORDER BY c2.level ASC, c2.display_order ASC, c2.id ASC
    LIMIT 1
  );


-- ====================================================
-- VERIFICATION — run these after the script succeeds.
-- Expected results are written next to each query.
-- ====================================================

-- 1. Three level groups: 7 roots, 31 subcategories, 149 leaves.
SELECT level, count(*) FROM public.categories GROUP BY level ORDER BY level;

-- 2. Expected 0: every mega-menu row is linked to its category.
SELECT count(*) FROM public.menu_items
WHERE (id::text LIKE 'd1c%' OR id::text LIKE 'd2c%' OR id::text LIKE 'd3c%')
  AND category_id IS NULL;

-- 3. Expected 6: the legacy flat navigation rows (Home & Shop, Electronics &
--    Tech, Fashion & Lifestyle, Vendor Portal, Admin Panel, Super Admin System)
--    keep category_id IS NULL by design — they are not taxonomy.
SELECT count(*) FROM public.menu_items WHERE category_id IS NULL;

-- 4. Expected public.site_categories (NOT NULL): this bundle does not drop the
--    table. apply-02 drops it later, after the replacement code is deployed.
SELECT to_regclass('public.site_categories');

-- 5. Expected 8: Watches occurs twice in the tree (level 2 under Accessories,
--    level 3 under Fashion > Accessories); the other six names occur once.
SELECT count(*) FROM public.categories
WHERE name IN ('Mobiles','Laptops','Headphones','Watches','Bags','Cameras','Gaming');

-- 6. Expected 0: no category tile is left without an image.
SELECT count(*) FROM public.categories WHERE image_url IS NULL;

-- 7. Every cmd = 'ALL' row must show roles = {service_role}.
--    The cmd = 'SELECT' rows are the public reads of active rows.
SELECT tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('categories','promo_banners','footer_sections','footer_links','hero_slides')
ORDER BY tablename, cmd, policyname;

-- 8. Expected 5 rows: categories, promo_banners, footer_sections,
--    footer_links, hero_slides all carry trg_set_updated_at.
SELECT event_object_table, trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'trg_set_updated_at'
ORDER BY event_object_table;
