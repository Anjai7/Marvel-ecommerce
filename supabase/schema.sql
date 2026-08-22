-- ==========================================
-- MARVEL E-COMMERCE SUPABASE DATABASE SCHEMA
-- Multi-Role Auth, Dynamic Menu, Products & Orders
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
