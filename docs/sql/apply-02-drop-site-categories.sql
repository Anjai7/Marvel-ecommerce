-- Apply bundle 02: drop the legacy site_categories table
--
-- WHEN: only AFTER Task 6's code is deployed. Until Task 13 the storefront still
-- calls the old GET /api/content/categories path; Task 6 keeps that path alive
-- with a temporary alias that reads public.categories, so dropping the old
-- table is safe once that code is live. Applying this before the code ships
-- would 500 the homepage category strip.
--
-- WHERE: the Supabase SQL Editor (or psql) against the project that has already
-- had apply-01-content-taxonomy.sql applied.
--
-- THIS FILE IS NOT APPLIED FROM THIS MACHINE. The human partner runs it.

DROP TABLE IF EXISTS public.site_categories;

-- Verification: expect NULL (the table no longer exists).
SELECT to_regclass('public.site_categories');
