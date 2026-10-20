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
