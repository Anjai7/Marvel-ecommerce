-- ====================================================
-- APPLY BUNDLE 09 — ORDER PRICE BREAKDOWN
--
-- WHAT: the nullable columns that persist the coupon discount and the
--       delivery split the checkout already computes. Before this bundle
--       the discount and the shipping split lived only in the browser's
--       sessionStorage, so they were not durable with the order.
--
-- WHERE: the Supabase SQL Editor (or psql) against the project that runs
--        the earlier bundles.
--
-- THIS FILE IS NOT APPLIED FROM THIS MACHINE. The human partner runs it.
--
-- Safe to re-run: every column uses IF NOT EXISTS and nothing is added as
-- NOT NULL, so an existing `orders` table keeps its rows and the bundle can
-- be pasted twice. It removes nothing.
--
-- Nullable on purpose: orders placed before this bundle — and orders without
-- a coupon — simply keep NULL, and the API treats NULL as "no breakdown".
-- ====================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;

-- ====================================================
-- Verify:
--
--   SELECT subtotal, discount_amount, shipping_fee, coupon_code
--   FROM public.orders
--   ORDER BY created_at DESC
--   LIMIT 10;
-- ====================================================
