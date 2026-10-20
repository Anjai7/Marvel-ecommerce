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
