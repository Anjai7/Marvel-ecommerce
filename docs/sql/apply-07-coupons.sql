-- ====================================================
-- APPLY BUNDLE 06 — COUPONS
--
-- WHAT: the `coupons` table behind the admin coupon screen and the
--       storefront checkout coupon endpoints (POST /api/coupons/validate,
--       POST /api/coupons/redeem).
--
-- WHERE: the Supabase SQL Editor (or psql) against the project that
--        already runs the content bundles.
--
-- THIS FILE IS NOT APPLIED FROM THIS MACHINE. The human partner runs it.
--
-- Safe to re-run: the table is created IF NOT EXISTS and its policies are
-- dropped before they are created, so pasting the bundle twice is harmless.
-- It removes nothing.
--
-- `max_uses` of 0 means "no limit"; `used_count` starts at 0 and is bumped by
-- POST /api/coupons/redeem only after the order that consumes the discount
-- exists. `expires_at` is nullable — a coupon without one never expires.
-- ====================================================

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('percent', 'flat', 'free_shipping')),
    value NUMERIC NOT NULL,
    min_subtotal NUMERIC NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons (code);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_service ON public.coupons;
CREATE POLICY coupons_service ON public.coupons
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ====================================================
-- Verify:
--
--   SELECT count(*) FROM public.coupons;
--   SELECT code, kind, value, min_subtotal, max_uses, used_count, is_active FROM public.coupons;
-- ====================================================
