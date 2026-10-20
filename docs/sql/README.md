# Database handoff — applying the dynamic content schema

This is the single page for **you**, the human partner, to apply the database side of the
dynamic site content feature. Everything here is run by hand: this machine cannot reach the
database (no Docker, the Supabase project is not linked to the CLI, and there is no access
token or database password in `.env`).

**The order matters.** Applying the wrong bundle first breaks the homepage.

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

**If the guard inside the migration fires**, it raises with the actual and expected counts
(`categories seed mismatch: expected 7/31/149, got …`). That means the navigation tree in
the database is not the one the migration expects — resolve it before continuing.

---

## 2. Deploy the code that reads the new tables

The new API lives at `GET /api/categories` (plus `/api/categories/tree`,
`/api/categories/slug/:slug` and `/api/categories/path`). Deploy the branch that adds it
**before** running bundle 02.

Until the storefront is fully migrated, the old path `GET /api/content/categories` is kept
alive by a temporary alias that reads the new `categories` table — so bundle 02 is safe to
apply once the new code is live.

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

## 5. Check the site

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

## Rollback

| Step       | How to undo it                                                                                                                                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — schema | The migrations are additive. `DROP TABLE public.categories;` (and `promo_banners`, `footer_sections`, `footer_links`) plus `ALTER TABLE public.products DROP COLUMN category_id;` and `ALTER TABLE public.menu_items DROP COLUMN category_id;` removes the feature. The `menu_items` and `products` tables keep their data. |
| 2 — code   | Redeploy the previous commit. The old `GET /api/content/categories` path returns once the alias is gone.                                                                                                                                                                                                                    |
| 3 — drop   | **Not reversible** without the backup in step 3.                                                                                                                                                                                                                                                                            |
| 4 — seeds  | The seeds upsert; they do not delete. To undo, delete the rows the seeds created (they have deterministic `c1…` / `b1…` / `f1…` / `f2…` / `e1…` id prefixes).                                                                                                                                                               |

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
