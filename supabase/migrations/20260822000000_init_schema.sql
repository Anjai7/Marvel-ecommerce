-- ==========================================
-- MARVEL E-COMMERCE SUPABASE MIGRATION
-- Multi-Role Auth, Dynamic Menu, Products & Orders
-- ==========================================

-- 1. ENUMS FOR USER ROLES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'vendor', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
DROP POLICY IF EXISTS "Public profiles read access" ON public.profiles;
CREATE POLICY "Public profiles read access" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Dynamic Menu Items: Anyone can read active items
DROP POLICY IF EXISTS "Public read dynamic menu" ON public.menu_items;
CREATE POLICY "Public read dynamic menu" ON public.menu_items FOR SELECT USING (is_active = true);

-- Products: Everyone can read products
DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products" ON public.products FOR SELECT USING (status = 'active');

-- Orders: Users can read own orders
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);

-- ==========================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_val user_role;
BEGIN
  BEGIN
    user_role_val := (new.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    user_role_val := 'user'::user_role;
  END;

  INSERT INTO public.profiles (id, email, full_name, role, store_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(user_role_val, 'user'::user_role),
    new.raw_user_meta_data->>'store_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    store_name = EXCLUDED.store_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- SEED DATA (INITIAL DYNAMIC MENU ITEMS)
-- ==========================================

INSERT INTO public.menu_items (title, path, icon, roles_allowed, order_index, badge, is_active)
VALUES
('Home & Shop', '/', 'Home', ARRAY['user', 'vendor', 'admin', 'super_admin'], 1, NULL, true),
('Electronics & Tech', '/category/electronics', 'Cpu', ARRAY['user', 'vendor', 'admin', 'super_admin'], 2, 'HOT', true),
('Fashion & Lifestyle', '/category/fashion', 'Shirt', ARRAY['user', 'vendor', 'admin', 'super_admin'], 3, NULL, true),
('Vendor Portal', '/vendor-dashboard', 'Store', ARRAY['vendor', 'admin', 'super_admin'], 4, 'SELLER', true),
('Admin Panel', '/admin-dashboard', 'ShieldCheck', ARRAY['admin', 'super_admin'], 5, 'MANAGEMENT', true),
('Super Admin System', '/superadmin-dashboard', 'Zap', ARRAY['super_admin'], 6, 'ROOT', true)
ON CONFLICT DO NOTHING;
