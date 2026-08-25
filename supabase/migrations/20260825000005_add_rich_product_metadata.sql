-- ====================================================
-- ADD RICH METADATA & REGULATORY COLUMNS TO PRODUCTS
-- Move hardcoded product specifications & info into database
-- ====================================================

DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model_name TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS country_of_origin TEXT DEFAULT 'India / Global Componentry';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manufacturer_name TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS importer_packer TEXT DEFAULT 'Marvel Retail Operations Pvt. Ltd.';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manufacturing_date TEXT DEFAULT 'October 2025';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hsn_code TEXT DEFAULT '85183000';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gst_rate TEXT DEFAULT '18%';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '["CE Certified", "FCC Compliance", "RoHS Eco-Standard", "BIS Registered"]'::jsonb;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS in_box JSONB DEFAULT '["1x Main Device Unit", "1x Fast Charge Cable", "1x Quick Setup Guide", "1x Marvel Warranty Card"]'::jsonb;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS care_instructions JSONB DEFAULT '[]'::jsonb;
EXCEPTION
    WHEN others THEN null;
END $$;
