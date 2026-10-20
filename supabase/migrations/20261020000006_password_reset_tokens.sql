-- Password reset tokens: single-use, expiring proof of email ownership.
-- RLS is enabled with only a service-role policy; there is no public read policy.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + interval '30 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on password reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Service role full access on password reset tokens" ON public.password_reset_tokens
  FOR ALL TO service_role USING (true);
