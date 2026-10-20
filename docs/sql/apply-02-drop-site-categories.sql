-- Apply bundle 02: drop the legacy site_categories table
--
-- WHEN: only AFTER this branch's code is deployed. The storefront reads
-- GET /api/categories and GET /api/categories/tree; the old
-- GET /api/content/categories path and its temporary alias have both been
-- removed from the code, so nothing calls the dropped table any more.
-- Applying this before the new code ships would 500 the homepage category
-- strip.
--
-- WHERE: the Supabase SQL Editor (or psql) against the project that has already
-- had apply-01-content-taxonomy.sql applied.
--
-- THIS FILE IS NOT APPLIED FROM THIS MACHINE. The human partner runs it.

DROP TABLE IF EXISTS public.site_categories;

-- Verification: expect NULL (the table no longer exists).
SELECT to_regclass('public.site_categories');
