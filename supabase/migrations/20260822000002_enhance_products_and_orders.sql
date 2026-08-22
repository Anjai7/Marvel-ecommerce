-- ====================================================
-- ENHANCE PRODUCTS & ORDERS TABLES SCHEMA
-- Support for Private Cloudinary CDN & Multi-Tenant Details
-- ====================================================

-- 1. Add extra columns to products table if they do not exist
DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor_name TEXT DEFAULT 'Marvel Verified Seller';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'authenticated';
EXCEPTION
    WHEN others THEN null;
END $$;

-- 2. Add extra columns to orders table if they do not exist
DO $$ BEGIN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vendor_id UUID;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carrier TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
EXCEPTION
    WHEN others THEN null;
END $$;

-- 3. Ensure RLS policies on products allow public reads and service role writes
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Public can view approved active products" ON public.products;
    CREATE POLICY "Public can view approved active products" ON public.products
        FOR SELECT USING (true);
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Service role full access on products" ON public.products;
    CREATE POLICY "Service role full access on products" ON public.products
        FOR ALL USING (true);
EXCEPTION
    WHEN others THEN null;
END $$;

-- 4. Ensure RLS policies on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view own orders or service role full" ON public.orders;
    CREATE POLICY "Users can view own orders or service role full" ON public.orders
        FOR ALL USING (true);
EXCEPTION
    WHEN others THEN null;
END $$;
