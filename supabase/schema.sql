-- ==========================================
-- MARVEL E-COMMERCE SUPABASE DATABASE SCHEMA
-- Multi-Role Auth, Dynamic Menu, Products & Orders
--
-- ⚠️ STALE SNAPSHOT OF AN EARLY MIGRATION STATE — NOT A COMPLETE SCHEMA.
-- DO NOT USE THIS FILE TO BOOTSTRAP A DATABASE.
--
-- This file is a hand-maintained snapshot from an early stage of the project
-- and has never been re-dumped. It does not create every object the app uses
-- (for example public.hero_slides, public.password_reset_tokens, the
-- `menu_items.level` column, or public.site_categories, which migration
-- 20261020000009 drops), so running it alone produces a database the API
-- cannot serve.
--
-- The source of truth is supabase/migrations/*.sql, applied in order; see
-- docs/sql/apply-01-content-taxonomy.sql for the human-runnable bundle. The
-- content-taxonomy block at the end of this file mirrors migration
-- 20261020000007 only and is self-contained and re-runnable.
-- ==========================================

-- 1. ENUMS FOR USER ROLES
CREATE TYPE user_role AS ENUM ('user', 'vendor', 'admin', 'super_admin');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

-- 2. PROFILES TABLE (Linked to Auth.Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'user' NOT NULL,
    store_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DYNAMIC MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    icon TEXT DEFAULT 'Layers',
    parent_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    roles_allowed TEXT[] DEFAULT ARRAY['user', 'vendor', 'admin', 'super_admin']::TEXT[],
    order_index INT DEFAULT 0,
    badge TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    original_price NUMERIC(10, 2),
    category TEXT NOT NULL,
    vendor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    stock INT DEFAULT 10,
    rating NUMERIC(2, 1) DEFAULT 4.5,
    reviews_count INT DEFAULT 0,
    image_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_amount NUMERIC(10, 2) NOT NULL,
    status order_status DEFAULT 'pending',
    items_count INT DEFAULT 1,
    shipping_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, Admins/Super Admins can read all profiles
CREATE POLICY "Public profiles read access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update profiles" ON public.profiles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Dynamic Menu Items: Anyone can read active items, Admins/Super Admins can modify
CREATE POLICY "Public read dynamic menu" ON public.menu_items FOR SELECT USING (is_active = true);
CREATE POLICY "Admin full manage dynamic menu" ON public.menu_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Products: Everyone can read products, Vendors/Admins can manage products
CREATE POLICY "Public read active products" ON public.products FOR SELECT USING (status = 'active');
CREATE POLICY "Vendors manage own products" ON public.products FOR ALL USING (
  auth.uid() = vendor_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Orders: Users can read/insert own orders; Vendors/Admins read all orders
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin', 'vendor')
  )
);
CREATE POLICY "Users place orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, store_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'user'::user_role),
    new.raw_user_meta_data->>'store_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- SEED DATA (INITIAL DYNAMIC MENU ITEMS)
-- ==========================================

INSERT INTO public.menu_items (title, path, icon, roles_allowed, order_index, badge, is_active) VALUES
('Home & Trending', '/', 'Home', ARRAY['user', 'vendor', 'admin', 'super_admin'], 1, NULL, true),
('All Products', '/products', 'ShoppingBag', ARRAY['user', 'vendor', 'admin', 'super_admin'], 2, 'HOT', true),
('Categories', '/categories', 'Grid', ARRAY['user', 'vendor', 'admin', 'super_admin'], 3, NULL, true),
('Deals & Offers', '/deals', 'Tag', ARRAY['user', 'vendor', 'admin', 'super_admin'], 4, 'PROMO', true),
('Vendor Dashboard', '/vendor', 'Store', ARRAY['vendor', 'admin', 'super_admin'], 5, 'VENDOR', true),
('Admin Control Panel', '/admin', 'ShieldCheck', ARRAY['admin', 'super_admin'], 6, 'ADMIN', true),
('Super Admin System', '/super-admin', 'Zap', ARRAY['super_admin'], 7, 'SYSTEM', true);

-- ==========================================
-- DYNAMIC SITE CONTENT (migration 20261020000007)
-- Category taxonomy, checkout-free content tables, bindings and triggers.
--
-- HAND-MAINTAINED, NOT DUMPED: `supabase db dump` needs a linked project,
-- which is unavailable in this environment. Replace this section with a real
-- dump once the project is linked. This file also predates migrations
-- 20261016000006 (hero_slides, site_categories) and 20261020000006
-- (password_reset_tokens), so a dump is the only way to get it complete.
-- ==========================================

-- 6. CATEGORIES (3-level taxonomy; slug is the last path segment only)
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

-- 7. TAXONOMY BINDINGS
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_category_id_idx
    ON public.products (category_id);

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 8. PROMO BANNERS (home banner layout / promo carousel / promo strip)
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

-- 9. FOOTER SECTIONS AND LINKS
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

-- 10. RLS FOR THE CONTENT TABLES (public reads active rows, service_role writes)
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

-- hero_slides is NOT created by this file; its scoped policy lives in
-- migration 20261020000007, which is the source of truth. Nothing about that
-- table may be added here — it would abort this snapshot on a fresh database.

-- 11. updated_at TRIGGER
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
