-- =========================================================
-- 20260822000004_fix_profiles_and_auth_trigger.sql
-- Grant full privileges to supabase_auth_admin and fix trigger
-- =========================================================

-- 1. Ensure enum exists and grant usage
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'vendor', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

GRANT USAGE ON TYPE public.user_role TO anon, authenticated, service_role, postgres, supabase_auth_admin;

-- 2. Ensure table permissions
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role, postgres, supabase_auth_admin;

-- 3. Drop old trigger to be 100% clean
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 4. Recreate bulletproof function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  extracted_role user_role := 'user'::user_role;
  extracted_name TEXT;
  extracted_store TEXT;
BEGIN
  BEGIN
    IF new.raw_user_meta_data IS NOT NULL AND new.raw_user_meta_data->>'role' IS NOT NULL THEN
      extracted_role := (new.raw_user_meta_data->>'role')::user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    extracted_role := 'user'::user_role;
  END;

  extracted_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  extracted_store := new.raw_user_meta_data->>'store_name';

  INSERT INTO public.profiles (id, email, full_name, role, store_name, status)
  VALUES (
    new.id,
    new.email,
    extracted_name,
    extracted_role,
    extracted_store,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    store_name = EXCLUDED.store_name,
    status = 'active',
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never crash auth.users creation
  RETURN NEW;
END;
$$;

-- 5. Re-attach trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
