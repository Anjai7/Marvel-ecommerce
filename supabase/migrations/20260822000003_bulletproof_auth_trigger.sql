-- ==========================================
-- 20260822000003_bulletproof_auth_trigger.sql
-- Fix handle_new_user() trigger with bulletproof error handling
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
  -- Never abort auth.users creation even if profile write fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
