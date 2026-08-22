-- ==========================================
-- 20260822000001_seed_roles_and_trigger.sql
-- Update trigger & safely handle auth profiles
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
