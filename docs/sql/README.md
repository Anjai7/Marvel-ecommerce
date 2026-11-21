# Database handoff — applying the dynamic site content schema

This is the single page for **you**, the human partner, to apply the database side of the
dynamic site content feature.

**The schema is already applied** (see "Status" below). The bundles here stay as the
source of truth and the fallback path: the Supabase project is not linked to the CLI and
there is no database password in `.env`, so `npm run db:push` cannot be used.

**The order matters.** Applying the wrong bundle first breaks the homepage.

---

## Status — applied 2026-10-20

The five outstanding migrations were applied to project `hyyjkyztxikohdywqagp`:

| Version          | File                                                           |
| ---------------- | -------------------------------------------------------------- |
| `20261016000006` | `supabase/migrations/20261016000006_dynamic_menus_banners.sql` |
| `20261020000006` | `supabase/migrations/20261020000006_password_reset_tokens.sql` |
| `20261020000007` | `supabase/migrations/20261020000007_content_taxonomy.sql`      |
| `20261020000008` | `supabase/migrations/20261020000008_seed_categories.sql`       |
| `20261020000009` | `supabase/migrations/20261020000009_drop_site_categories.sql`  |

`20260822000000`–`20260825000005` were already live before the CLI tracked this project;
their versions were backfilled into `supabase_migrations.schema_migrations` so the CLI
does not replay them.

**To apply future migrations**, run:

```bash
npm run db:apply
```

That script inspects the database, reconciles the history, applies only what is
outstanding, and verifies the result. It needs a DDL credential — a
`SUPABASE_ACCESS_TOKEN` (personal access token) or a `SUPABASE_DB_PASSWORD`. The
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` are data-plane only and
cannot run DDL.

### Pending — `20261022000000_pages.sql`

| Version          | File                                           | What it does                                                       |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `20261022000000` | `supabase/migrations/20261022000000_pages.sql` | the `pages` and `page_sections` tables behind the CMS page builder |

This migration has **not** been applied: the machine that wrote it has no DDL credential,
so it is a hand-off only. It creates `public.pages` (one CMS page — slug, lifecycle, SEO,
optional category binding) and `public.page_sections` (the ordered, type-tagged sections
of a page), and adds six nullable category-configuration columns (`meta_title`,
`meta_description`, `canonical_url`, `listing_layout`, `listing_sort`,
`listing_page_size` — a null means "not configured").

**Apply it** with `npm run db:apply` (needs a `SUPABASE_ACCESS_TOKEN` or a
`SUPABASE_DB_PASSWORD`), or paste the whole file into the Supabase **SQL Editor**. The
migration is additive and re-runnable: every table, column and index is created
`if not exists` and every policy is dropped before it is created, so pasting it twice is
harmless. It removes nothing.

**Verify:**

```sql
select count(*) from public.pages;
select status, count(*) from public.pages group by status;
select id, type, position from public.page_sections order by page_id, position;
```

**Expected:** `pages` is empty on a fresh database; every `page_sections` row has a `type`
in the twelve-type allowlist (`hero`, `richtext`, `image`, `gallery`, `product_grid`,
`category_grid`, `promo_banner`, `cta`, `faq`, `video`, `category_listing`, `spacer`) and a
dense 0-based `position` within its page.

---

## 0. Before anything: check `JWT_SECRET`

The API now refuses to start in production with a missing or short signing secret.

```
JWT_SECRET=replace_me
```

in `.env` is a **30-character placeholder** and therefore **fails** the new gate (it needs
**32 or more** characters). In development the server falls back to a random per-process
secret and logs a warning; in production it refuses to boot.

Generate a real one before deploying:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the result in `.env` as `JWT_SECRET=`. Never commit it.

---

## 1. Apply the taxonomy and the content tables

**File:** [`apply-01-content-taxonomy.sql`](./apply-01-content-taxonomy.sql)

**Where:** the Supabase **SQL Editor** (Dashboard → your project → SQL Editor → New query),
or `psql`. Paste the whole file and run it.

**What it does:**

- creates `categories` (3 levels, `parent_id` self-reference, unique slug per parent), and
  adds `products.category_id` and `menu_items.category_id`;
- creates `promo_banners`, `footer_sections`, `footer_links`;
- creates the `set_updated_at()` trigger and attaches it to the five content tables;
- creates the **scoped** RLS policies (`FOR ALL TO service_role`, plus a public
  `FOR SELECT` of active rows);
- seeds the `categories` tree from the existing `menu_items` navigation, in three
  level-ordered inserts so the self-referencing foreign key is satisfied, and links each
  navigation row back to its category.

**It does not drop anything.** The old `site_categories` table is left in place — bundle 02
drops it later, once the replacement code is live.

**Verify** (the queries and their expected results are also in the bundle's trailing
comment block):

| #   | Query                                                                                                                                                                                   | Expected                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `SELECT level, count(*) FROM public.categories GROUP BY level ORDER BY level;`                                                                                                          | three rows: **7 / 31 / 149**                                                                                                                                                                  |
| 2   | `SELECT count(*) FROM public.menu_items WHERE (id::text LIKE 'd1c%' OR 'd2c%' OR 'd3c%') AND category_id IS NULL;`                                                                      | **0**                                                                                                                                                                                         |
| 3   | `SELECT count(*) FROM public.menu_items WHERE category_id IS NULL;`                                                                                                                     | **6** — the legacy flat rows (Home & Shop, Electronics & Tech, Fashion & Lifestyle, Vendor Portal, Admin Panel, Super Admin System) are navigation-only by design and never become categories |
| 4   | `SELECT to_regclass('public.site_categories');`                                                                                                                                         | still present — bundle 01 does not drop it                                                                                                                                                    |
| 5   | `SELECT count(*) FROM public.categories WHERE name IN ('Mobiles','Laptops','Headphones','Watches','Bags','Cameras','Gaming');`                                                          | **8** — `Watches` is a title twice (level 2 and level 3), the other six once                                                                                                                  |
| 6   | `SELECT count(*) FROM public.categories WHERE image_url IS NULL;`                                                                                                                       | **0** — no category tile is left without an image                                                                                                                                             |
| 7   | `SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('categories','promo_banners','footer_sections','footer_links','hero_slides');` | every `cmd = 'ALL'` row shows `roles = {service_role}`; the `cmd = 'SELECT'` rows are the public reads                                                                                        |
| 8   | `SELECT event_object_table, trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_set_updated_at';`                                     | **5** rows — one per content table                                                                                                                                                            |

**If the guard inside the migration fires**, it has found a broken tree, and its message says
which check failed:

| Message                                                                   | What it means                                                                                                                      |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `categories seed produced N rows above level 1 with no parent row`        | a row's parent is missing — the paste was interrupted part-way, or a row was deleted by hand. Re-run the bundle; it is idempotent. |
| `categories seed produced N rows with an empty slug`                      | a row's path had no last segment. Re-run the bundle.                                                                               |
| `categories seed produced N rows whose level does not match their parent` | the tree's levels and parents disagree. Re-run the bundle.                                                                         |

The guard checks the **tree's own integrity**, not its completeness against `menu_items`:
deleting a category in the admin panel is a legitimate state and does **not** make the
bundle abort. On success the migration raises a notice with the level counts
(`categories tree verified: 7 roots, 31 subcategories, 149 leaves`).

**Re-running bundle 01** is safe for the schema, and it resets two things on the rows the
migration owns: the seeded `show_in_homepage` flags and the seeded category images. It
touches nothing else, so a homepage tile you switched off in the admin panel will come
back on if you re-paste the bundle.

---

## 2. Deploy the code that reads the new tables

The new API lives at `GET /api/categories` (plus `/api/categories/tree`,
`/api/categories/slug/:slug` and `/api/categories/path`). Deploy the branch that adds it
**before** running bundle 02.

Until the storefront is fully migrated, the old path `GET /api/content/categories` is kept
alive by a temporary alias that reads the new `categories` table — so bundle 02 is safe to
apply once the new code is live.

**That alias no longer exists.** The storefront is fully migrated: it reads
`/api/categories` and `/api/categories/tree`, the old editor is deleted, and the temporary
`GET`/`POST`/`DELETE /api/content/categories` routes have been removed from the code. So
bundle 02 is safe to apply as soon as this branch is deployed — nothing calls the dropped
table any more.

---

## 3. Drop the old table

**File:** [`apply-02-drop-site-categories.sql`](./apply-02-drop-site-categories.sql)

**Where:** the Supabase SQL Editor. Paste and run.

**What it does:** `DROP TABLE IF EXISTS public.site_categories;`

**Verify:** `SELECT to_regclass('public.site_categories');` → **NULL**

> **This one is not reversible.** The dropped rows are the ten old homepage category
> circles. Take a backup first if you want them:
> `CREATE TABLE public.site_categories_backup AS SELECT * FROM public.site_categories;`

---

## 4. Populate the content

**File:** [`apply-03-run-seeds.md`](./apply-03-run-seeds.md)

**Where:** **your machine**, in the project checkout, with a working `.env`.

The seeds need the service-role key, because the tables are behind scoped RLS policies.

```bash
npm run seed:content     # banners, footer sections and links
npm run seed:products    # products across the whole taxonomy
```

**Verify:**

```sql
SELECT count(*) FROM public.promo_banners;     -- 9
SELECT count(*) FROM public.footer_sections;  -- 5
SELECT count(*) FROM public.footer_links;     -- 34
SELECT count(*) FROM public.products WHERE category_id IS NOT NULL;  -- >= 52
```

`products` whose `category_id IS NULL` are the legacy rows whose free-text category
matches no taxonomy row. That is expected — the seed rewrites the rows it owns, and the
ones it does not own keep their original label.

**Both seeds are idempotent** — they upsert by deterministic id and never delete. Run them
twice and the counts must not change.

> `npm run seed:products` uploads images to Cloudinary when `CLOUDINARY_CLOUD_NAME` and
> `CLOUDINARY_API_KEY` are set, and falls back to plain Unsplash URLs when they are not.
> It fetches and uploads one image per product, so it is network-bound and takes a few
> minutes.

---

## 5. Product options and variants

**File:** [`apply-04-product-variants.sql`](./apply-04-product-variants.sql)

**Where:** the Supabase **SQL Editor**. Paste the whole file and run it.

**What it does:**

- widens `public.product_variants.kind` from `('color','size')` to the eight kinds a
  product can be sold on — `color`, `size`, `capacity`, `storage`, `material`, `style`,
  `weight`, `flavour` — and adds `option_value_id`, the link to the catalogue;
- creates `public.product_option_values`, the **shared catalogue**: one row per
  `(kind, label)` in the whole store. A product links its option values to it, so
  renaming "Black" to "Obsidian Black" in the catalogue renames it on every product that
  uses it;
- creates `public.product_variant_combinations`, the **sellable variants**: one row per
  combination ("Blue / M") with its own `sku`, `price`, `stock` and `image_url`;
- backfills the catalogue from the option values that already exist, so nothing has to
  be entered twice;
- adds the indexes and the row-level-security policies for the two new tables.

**It is additive and re-runnable**: every table is created `if not exists`, the widened
`kind` check is dropped before it is added, and the backfill is an idempotent upsert.
Pasting it twice changes nothing the second time.

**Verify:** the queries and their expected results are in the bundle's trailing comment
block. The short version:

```sql
select to_regclass('public.product_option_values'),
       to_regclass('public.product_variant_combinations');
-- both present

select count(*) from public.product_variants v
where v.option_value_id is null and btrim(v.label) <> '';
-- 0: every option value is linked to the catalogue
```

**Until it is applied the site still works.** The product page falls back to the
product's own price and stock, the catalogue is simply empty, and the admin's option
editor tells you that the tables are missing rather than losing what you typed.

---

## 6. The admin audit log

**File:** [`apply-06-admin-audit-log.sql`](./apply-06-admin-audit-log.sql)

**Where:** the Supabase **SQL Editor**. Paste and run.

**What it does:**

- creates `public.admin_audit_log` — the append-only trail of the admin writes
  that matter (product create/update/delete, stock adjustments), with `action`,
  `entity`, `entity_id`, a JSONB `details` bag of before/after facts and the
  `actor` when the write came from an authenticated admin route;
- adds the `created_at` index (newest first) and the entity index the audit read
  sorts and filters by.

**It is additive and re-runnable**, and the write side degrades gracefully when
the bundle has not been applied: `server/lib/audit.js` wraps the insert and
answers a warning, so a product save is never lost to a missing table.

**Apply it** before expecting `GET /api/admin/audit` to return rows; until then
the endpoint answers successfully with an empty log.

**Verify:**

```sql
select count(*) from public.admin_audit_log;
select action, entity, entity_id, actor_email from public.admin_audit_log order by created_at desc limit 10;
```

---

## 7. The admin coupon catalogue

**File:** [`apply-07-coupons.sql`](./apply-07-coupons.sql)

**Where:** the Supabase **SQL Editor**. Paste and run.

**What it does:**

- creates `public.coupons` — the discount codes the admin screen manages:
  `code`, `kind` (`percent | flat | free_shipping`), `value`, `min_subtotal`,
  `max_uses` (0 = unlimited), `used_count`, `is_active`, `expires_at`.

**It is additive and re-runnable**, and the checkout endpoints
(`POST /api/coupons/validate`, `POST /api/coupons/redeem`) read this table, so
they need the bundle before they can validate or redeem a code. Until the bundle
has been applied the admin list reads an empty table and the storefront has no
codes to validate.

**Apply it** before using the coupon screen; until then the admin list reads an
empty table and the storefront has no codes to validate.

**Verify:**

```sql
select code, kind, value, min_subtotal, max_uses, used_count, is_active from public.coupons;
```

---

## 8. Check the site

```bash
npm run dev:all
```

- the homepage shows the hero, the category strip and the banner blocks;
- the navigation is the three-level tree;
- clicking a category lands on `#/category/<ancestor path>` and lists its products;
- the admin panel (**Site Content** in the sidebar) has an editor for each of: Menus, Hero,
  Categories, Banners, Footer.

Then run the browser suite — the two specs that need the database should now run instead
of skipping:

```bash
npm run test:e2e
```

---

## 9. Customer return requests

**File:** [`apply-05-returns.sql`](./apply-05-returns.sql)

**Where:** the Supabase **SQL Editor**, or `npm run db:apply`.

**What it does:** creates `public.returns` — one row per customer return request (order id,
the caller's profile, reason slug, notes, created at). The customer UI posts through
`POST /api/orders/:id/return` (server/routes/orders.js) and does not read this table back;
the reasons are the four the UI offers: `damaged`, `wrong_item`, `changed_mind`, `other`.

**Idempotent:** every table, index and policy is created or replaced; re-running the file
is harmless.

**Verify:**

```sql
select to_regclass('public.returns');
select reason, count(*) from public.returns group by reason;
```

**Apply with:** `npm run db:apply` (needs a `SUPABASE_ACCESS_TOKEN` or
`SUPABASE_DB_PASSWORD` — the CLI could not be used for the earlier bundles, see §0).

---

## 10. Stored product codes

**File:** [`apply-08-product-code.sql`](./apply-08-product-code.sql)

**Where:** the Supabase **SQL Editor**.

**What it does:** adds `public.products.code` (a short text column), backfills all 1,503
existing products with the exact code their badges already show (`FAS379`, `ELE969`,
`BTY639`, …), and indexes the column so admin search stays fast. The codes in the bundle
were generated with the same `generateProductCode()` the UI uses, so nothing on screen
changes when it is applied.

The code is **not unique**: 55 codes are currently shared by more than one product,
because the generator derives its number from the last three digits of the product id.
An admin can edit the code in the product form to disambiguate any of them.

**Idempotent:** the column and index use `IF NOT EXISTS` and the backfill only fills
blank codes, so an edited code is never overwritten by a re-run.

**Before it is applied:** the API keeps deriving the code on read and keeps saving
products — a write that carries `code` is retried without it when PostgREST reports the
column missing. After it is applied, the stored value is the source of truth and the
**Item code** field in the product form edits it.

**Verify:**

```sql
select code, count(*) from public.products group by code having count(*) > 1 limit 10;
select id, title, code from public.products where code = 'FAS379';
```

---

## Rollback

| Step        | How to undo it                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — schema  | The migrations are additive. `DROP TABLE public.categories;` (and `promo_banners`, `footer_sections`, `footer_links`) plus `ALTER TABLE public.products DROP COLUMN category_id;` and `ALTER TABLE public.menu_items DROP COLUMN category_id;` removes the feature. The `menu_items` and `products` tables keep their data.                     |
| 2 — code    | Redeploy the previous commit. The old `GET /api/content/categories` path returns once the alias is gone.                                                                                                                                                                                                                                        |
| 3 — drop    | **Not reversible** without the backup in step 3.                                                                                                                                                                                                                                                                                                |
| 4 — seeds   | The seeds upsert; they do not delete. To undo, delete the rows the seeds created (they have deterministic `c1…` / `b1…` / `f1…` / `f2…` / `e1…` id prefixes).                                                                                                                                                                                   |
| 5 — options | Bundle 04 is additive too. `DROP TABLE public.product_variant_combinations; DROP TABLE public.product_option_values;` and `ALTER TABLE public.product_variants DROP COLUMN option_value_id;` undo it; the option values that were already stored stay in `product_variants` and the storefront falls back to the product's own price and stock. |

`supabase/schema.sql` is a **stale snapshot** of an early migration state, not a complete
schema. Do **not** bootstrap a database from it — use the migrations in
`supabase/migrations/` in order. It should be regenerated with `supabase db dump` once a
linked project is available.

---

## Still open (not part of this feature)

These write surfaces are **still unauthenticated**. They are deliberate follow-ups, not
oversights of this slice:

| Route                                                                                                           | File                        |
| --------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `POST /api/products`, `PUT /api/products/:id`, `PATCH /api/products/:id/moderation`, `DELETE /api/products/:id` | `server/routes/products.js` |
| `GET /api/orders`, `POST /api/orders`, `PATCH /api/orders/:id/status`                                           | `server/routes/orders.js`   |
| `GET /api/users` (returns every profile)                                                                        | `server/routes/users.js`    |

The whole content surface **is** protected — `server/routes/authz.test.js` asserts that
every content write route answers `401` without a token and `403` for a non-admin, and that
the database is never touched.
