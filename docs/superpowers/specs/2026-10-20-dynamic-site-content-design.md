# Dynamic Site Content & Category Taxonomy — Design Spec

Date: 2026-10-20
Status: Approved
Slice: storefront content model + admin content editing
Repo: `marvel-ecommerce` (branch `feature/dynamic-content`)
Related: `2026-10-16-dynamic-menus-banners-design.md` (the previous slice that introduced `menu_items`, `hero_slides`, `site_categories`)
Implementation plan: `docs/superpowers/plans/2026-10-20-dynamic-site-content.md`

This document is the binding authority for the implementation. DDL, column names, route
paths, response keys, error strings and ordering semantics below are normative. If the plan
and this document disagree, this document wins and the plan is corrected.

## 1. Goals / Non-Goals

### 1.1 Goals

1. Every **structured** content block that the storefront renders is stored in Supabase and
   editable from the admin panel with no code deploy: hero slides, the navigation /
   mega-menu tree, the homepage banner layout, the promo carousel, the promo strip, the
   footer link columns plus the popular-search tags, and the category taxonomy.
2. One taxonomy — `categories`, three levels deep — is the single source of truth for
   categories. Products and menu leaves point at it by id, and a category URL is derived
   from the tree by walking `parent_id`, so a path can never disagree with the taxonomy.
3. Category URLs keep the format the site already uses:
   `/category/electronics/mobiles/smartphones`. The URL is rebuilt by walking
   `parent_id` ancestors; `categories.slug` is only the last path segment.
4. An admin can create, edit, hide/restore, delete and reorder every content row. Hiding a
   row never removes it from the admin list.
5. A partial edit never destroys data: `PATCH` writes only the keys the caller sent.
6. The storefront reads all content from one `ContentContext` load instead of per-component
   fetches and `src/data.js` fallbacks. There is no silently blank hero and no
   "no items" list that looks like real data when the API failed.
7. The database lands fully populated: every new table is seeded from content that already
   exists in the repo, and every category page has products.
8. The content write surface is authenticated and role-guarded end to end, and the new
   tables use scoped RLS.

### 1.2 Success criteria

- `npm run check` (oxlint → vitest → vite build) exits 0.
- `npm run test:e2e` passes, including a category page spec and an admin round-trip spec
  (edit a banner title / category name in the admin, reload the storefront, see the change).
- No file under `src/` imports `src/data.js`; the file is deleted.
- A visitor with no token receives `401` and a `user`-role token receives `403` on every
  content write route, with zero database writes.
- Re-running both seed scripts does not change any row count.
- The verification gates in §9.2 pass against a staging database.

### 1.3 Non-Goals

- Not a CMS. No drafts/revisions, no scheduling UI beyond `starts_at`/`ends_at` on banners,
  no multi-language content, no workflow approvals.
- Not a page builder. Layout structure stays in code; only the content rows are dynamic.
- No new UI framework, CSS framework or state library. React 19 + existing Radix/Lucide
  primitives + plain CSS only.
- Not a products/orders/billing slice. Nothing in this feature changes checkout, order
  status or payment. `products`/`orders` write authorization, unauthenticated
  `GET /api/users`, replacing `products.category` with ids only, the fake product builder
  and the stubbed checkout are all follow-ups (§11).
- Not a formatting chore: no repo-wide `npm run format`, no Prettier baseline reset, no
  `prettier --check`/Knip in CI.
- Not a redesign of the storefront.

## 2. Scope

### 2.1 In scope

| Surface                                    | Source of truth after this feature                        | Admin editor                                        |
| ------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------- |
| Homepage hero carousel                     | `hero_slides`                                             | `HeroSlidesEditor` (refactored onto the editor kit) |
| Top navigation / mega-menu                 | `menu_items` (linked to `categories` by `category_id`)    | `MenuTreeEditor` (fixed and mounted)                |
| Homepage banner layout (1 large + 2 small) | `promo_banners` where `placement = 'home_banner_layout'`  | `BannersEditor`                                     |
| Homepage promo carousel                    | `promo_banners` where `placement = 'home_promo_carousel'` | `BannersEditor`                                     |
| Homepage promo strip                       | `promo_banners` where `placement = 'promo_strip'`         | `BannersEditor`                                     |
| Footer link columns + popular-search tags  | `footer_sections` + `footer_links`                        | `FooterEditor`                                      |
| Category / subcategory / leaf taxonomy     | `categories`                                              | `CategoriesTreeEditor`                              |
| Category landing pages                     | `categories` + `products.category_id`                     | `CategoryPicker`, product forms                     |

**Scope boundary.** This feature covers _structured content blocks only_. Marketing
micro-copy — section headings such as "Trending Now", the footer value-prop bar, social
labels, payment chips and product-card chrome — **stays in code**. It is not migrated, not
seeded, and not editable. Any request to make those strings editable is a new slice.

### 2.2 Reading order for implementers

Data Model (§3) → API Contract (§4) → Client Architecture (§5) → Admin UX (§6) → Seed Data
(§7) → Security (§8) → Migration & Rollback (§9). Sections 10 and 11 are constraints and
deferrals, not work items.

## 3. Data Model

### 3.1 Entity overview

| Table                    | Status                      | Purpose                                                                                                   | Public read      |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------- |
| `categories`             | new                         | 3-level taxonomy; `parent_id` self-FK                                                                     | active rows only |
| `promo_banners`          | new                         | banner layout, promo carousel and promo strip rows                                                        | active rows only |
| `footer_sections`        | new                         | footer columns and the popular-search block                                                               | active rows only |
| `footer_links`           | new                         | links and tags that belong to a footer section                                                            | active rows only |
| `products.category_id`   | new column                  | binds a product to a taxonomy leaf                                                                        | n/a              |
| `menu_items.category_id` | new column                  | binds a nav leaf to a taxonomy node                                                                       | n/a              |
| `hero_slides`            | existing                    | hero carousel rows; gains an `updated_at` trigger and a service-role policy                               | active rows only |
| `site_categories`        | dropped in `20261020000009` | the 10 legacy homepage circles; the 7 whose names match a taxonomy row are copied into `categories` first | n/a              |

All new columns are snake_case in the database and in JSON. There is no camelCase
transform layer anywhere in the stack.

### 3.2 `categories`

```sql
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
  description TEXT,
  icon TEXT,
  image_url TEXT,
  banner_image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_in_nav BOOLEAN NOT NULL DEFAULT true,
  show_in_homepage BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_root_unique ON public.categories (slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_child_unique ON public.categories (parent_id, slug) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS categories_parent_order ON public.categories (parent_id, display_order);
CREATE INDEX IF NOT EXISTS categories_active_order ON public.categories (is_active, display_order);
```

**Semantics.**

- `level` is 1 (category), 2 (subcategory) or 3 (leaf). It is stored, not derived at read
  time, and the server validates it on every write.
- `parent_id IS NULL` exactly when `level = 1`. A level-2 row's parent must be level 1; a
  level-3 row's parent must be level 2. Depth is capped at 3; a 4th level is rejected with
  `400` (section 4.8).
- `slug` is unique **per parent**: roots are globally unique, children are unique among
  their siblings. Two different parents may both have a child slug `accessories`, and a
  child slug may equal a root slug. A bare slug is therefore **not** an identifier.
- `slug` is lowercase letters, numbers and hyphens only (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- **The full path is the identity.** The category path is
  `/category/<root slug>/<child slug>/<leaf slug>`, rebuilt by walking ancestors, and two
  categories can only share a path if they are the same row. `categories.slug` is the last
  path segment only. Every lookup that has to name one category uses the whole path, never
  the bare slug (section 4.2).
- **Slug versus name.** The slug _is_ the URL path segment and is independent of the display
  name: the seed copies the segment that already exists in `menu_items.path`
  (`men-s-fashion`) and never re-slugifies the name, while `slugify` produces only the
  _suggested default_ filled into the form for a newly created row. The two agree for
  `Men's Fashion` under the current rule, but the seed does not rely on that — a hand-edited
  path segment always wins. Changing a category's `slug` changes its path and therefore its
  URL and its menu path; changing its `name` does not change either. Deleting
  `site_categories` does not change any existing menu path.
- `show_in_nav` controls whether the category appears in nav surfaces built from the
  taxonomy; `show_in_homepage` controls the homepage category strip.
- `is_active = false` hides the row from the storefront but keeps it in the admin list.
- Deleting a row cascades to its descendants through the FK.

### 3.3 Product and menu bindings

```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products (category_id);

ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
```

**`products.category` is kept.** It is a `NOT NULL` free-text display label and stays the
column that `src/components/product/dynamicProductBuilder.js:84-123` string-matches and that
`ProductCard`, breadcrumbs and the admin catalog search read. `category_id` is the binding
used for filtering and for the relationship to the taxonomy. When a write supplies
`category_id` and no `category` text, the server fills `category` from the category's
`name`; when both are supplied, both are stored. The two can drift if the category is later
renamed — that is a documented follow-up, not a feature of this slice (§11 item 6).

**`menu_items.category_id`** lets a menu leaf point at the taxonomy. The menu tree builder
already spreads every column, so `category_id` flows through the API without changing
`buildMenuTree`.

### 3.4 `promo_banners`

```sql
CREATE TABLE IF NOT EXISTS public.promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement TEXT NOT NULL CHECK (placement IN ('home_banner_layout','home_promo_carousel','promo_strip')),
  variant TEXT NOT NULL DEFAULT 'standard',
  badge TEXT, title TEXT NOT NULL, subtitle TEXT, highlight TEXT, description TEXT,
  cta_text TEXT, cta_path TEXT,
  image_url TEXT, bg_image_url TEXT, fallback_image_url TEXT, bg_gradient TEXT,
  emoji TEXT, code TEXT, accent TEXT, bg_color TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS promo_banners_placement_order ON public.promo_banners (placement, display_order);
```

**Semantics.**

- `placement` is the surface selector and is immutable in meaning: exactly one of
  `home_banner_layout`, `home_promo_carousel`, `promo_strip`.
- `variant` is free text with a default of `standard`; the storefront only uses `large` and
  `small` on `home_banner_layout` (one `large` slot, two `small` slots). Any other value
  renders as `small`.
- Fields a placement does not use are stored as-is and ignored by the storefront; they are
  not rejected, so a banner can move between placements without losing its copy.
- `gallery` is a Postgres text array of absolute image URLs; the API always sends and
  receives it as a JSON array of strings.
- `starts_at`/`ends_at` are optional ISO-8601 timestamps. A banner whose window is in the
  future or has ended is still returned by the public list; the storefront decides what to
  render from `ends_at` (the carousel countdown).
- `display_order` is scoped **per placement**: the reorder operation renumbers the banners
  of one placement only.

### 3.5 `footer_sections` and `footer_links`

```sql
CREATE TABLE IF NOT EXISTS public.footer_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heading TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'links' CHECK (section_type IN ('links','tags')),
  column_index INT NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.footer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.footer_sections(id) ON DELETE CASCADE,
  label TEXT NOT NULL, href TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS footer_links_section_order ON public.footer_links (section_id, display_order);
```

**Semantics.**

- `section_type = 'links'` renders as a column of anchors; `'tags'` renders as the popular
  search chips (the seeded "Popular Searches" block).
- `column_index` picks the visual column; `display_order` orders sections within the footer
  and links within a section. The two are independent: reordering sections never rewrites
  `column_index`.
- Deleting a section cascades to its links. The admin confirms with the link count shown.
- `href` is an https URL or a site-relative path (section 4.8).

### 3.6 `hero_slides` (existing) and the ordering-field reconciliation

`hero_slides` already exists (`supabase/migrations/20261016000006_dynamic_menus_banners.sql`)
with `id, badge, title, subtitle, btn_text, btn_path, bg_image_url, product_image_url,
fallback_image_url, bg_gradient, price_text, tag, ribbon_text, order_index, is_active,
created_at, updated_at`. This feature adds no column to it. It adds the `updated_at` trigger
(§3.8) and exposes it through the generic content CRUD factory.

`menu_items` also orders with its existing `order_index` column.

**Reconciliation, binding for every task.** Two pre-existing tables use `order_index`; all
new tables use `display_order`. The API keeps one request vocabulary:

- Every reorder body uses the key `display_order`, and the **array order is authoritative** —
  the server renumbers the scope to `0..n-1` from the array positions and ignores the
  submitted numbers.
- For `hero_slides` and `menu_items` those renumbered values are persisted to the existing
  `order_index` column, because that is what `buildMenuTree`, `GET /api/menu` and
  `GET /api/content/hero` already sort by (and what the previous slice's seed script reads
  as `m.order_index`).
- List and single-item responses for `hero_slides` and `menu_items` return the raw row, so
  they carry `order_index`; responses for the four new tables carry `display_order`.
- The CRUD factory config for hero therefore sets `orderColumn: "order_index"`; for
  categories, banners, sections and links it is `"display_order"`.

No task may add a `display_order` column to `hero_slides` or `menu_items`, and no task may
rename `order_index`.

### 3.7 Row Level Security

Every new table gets the same two policies, and **never** an unscoped
`FOR ALL USING (true)`: the `FOR ALL` policy is scoped to the `service_role`, which is the
only role the Express server uses (it holds the service key server-side). `anon` and
`authenticated` may only `SELECT` rows with `is_active = true`.

```sql
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
CREATE POLICY "Public read active categories" ON public.categories FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on categories" ON public.categories;
CREATE POLICY "Service role full access on categories" ON public.categories FOR ALL TO service_role USING (true);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active promo_banners" ON public.promo_banners;
CREATE POLICY "Public read active promo_banners" ON public.promo_banners FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on promo_banners" ON public.promo_banners;
CREATE POLICY "Service role full access on promo_banners" ON public.promo_banners FOR ALL TO service_role USING (true);

ALTER TABLE public.footer_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active footer_sections" ON public.footer_sections;
CREATE POLICY "Public read active footer_sections" ON public.footer_sections FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on footer_sections" ON public.footer_sections;
CREATE POLICY "Service role full access on footer_sections" ON public.footer_sections FOR ALL TO service_role USING (true);

ALTER TABLE public.footer_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active footer_links" ON public.footer_links;
CREATE POLICY "Public read active footer_links" ON public.footer_links FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access on footer_links" ON public.footer_links;
CREATE POLICY "Service role full access on footer_links" ON public.footer_links FOR ALL TO service_role USING (true);
```

`hero_slides` keeps its existing public-read policy and gains the same scoped
`FOR ALL TO service_role` policy:

```sql
DROP POLICY IF EXISTS "Service role full access on hero_slides" ON public.hero_slides;
CREATE POLICY "Service role full access on hero_slides" ON public.hero_slides FOR ALL TO service_role USING (true);
```

`password_reset_tokens` (created in `20261020000006`) has **only** the service-role policy;
it has no public read policy at all.

The verification query in §9.2 must show `roles = {service_role}` on every `FOR ALL` policy.

### 3.8 `updated_at` trigger

One trigger function, attached to `categories`, `promo_banners`, `footer_sections`,
`footer_links` and `hero_slides`. The function is created once; the trigger is dropped and
recreated per table so the migration is re-runnable.

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = timezone('utc', now()); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.categories;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.promo_banners;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.promo_banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.footer_sections;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.footer_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.footer_links;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.footer_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.hero_slides;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.hero_slides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

The trigger overwrites any client-supplied `updated_at`; the API never writes that column.

### 3.9 Index list

| Index                           | Table           | Columns                                         | Why                           |
| ------------------------------- | --------------- | ----------------------------------------------- | ----------------------------- |
| `categories_slug_root_unique`   | `categories`    | `(slug) WHERE parent_id IS NULL`                | root slug uniqueness          |
| `categories_slug_child_unique`  | `categories`    | `(parent_id, slug) WHERE parent_id IS NOT NULL` | sibling slug uniqueness       |
| `categories_parent_order`       | `categories`    | `(parent_id, display_order)`                    | tree build + sibling reorder  |
| `categories_active_order`       | `categories`    | `(is_active, display_order)`                    | public list / homepage strip  |
| `products_category_id_idx`      | `products`      | `(category_id)`                                 | product filtering by category |
| `promo_banners_placement_order` | `promo_banners` | `(placement, display_order)`                    | one query per placement       |
| `footer_links_section_order`    | `footer_links`  | `(section_id, display_order)`                   | links per section             |

Existing indexes on `menu_items (parent_id, order_index)`, `menu_items (is_active,
order_index)` and `hero_slides (is_active, order_index)` are reused unchanged.

## 4. API Contract

### 4.1 Conventions

- Prefix `/api`. JSON in, JSON out. `snake_case` keys.
- Errors are always `{ "error": "<human-readable string>" }`. Success bodies carry
  `{ "message": "..." }` plus a resource key.
- **List endpoints are wrapped**: `{ categories: [...] }`, `{ slides: [...] }`,
  `{ banners: [...] }`, `{ sections: [...], links: [...] }`. The single exception is
  `GET /api/menu`, which keeps its existing bare-array shape.
- **Auth.** Public reads need no token. Every write needs
  `Authorization: Bearer <jwt>` and a role of `admin` or `super_admin`. Missing/invalid
  token → `401`; valid token with the wrong role → `403`. No write may reach the database
  before the guard passes.
- **Partial updates.** `PATCH` validates with `{ partial: true }` (required-field checks are
  skipped for omitted fields) and writes **only the keys present in the request body**.
  Omitted fields keep their stored values. Sending `null` explicitly clears a nullable
  column — that is the only way to clear one.
- **Upsert.** `POST` accepts an optional `id`. With an `id` present it updates that row;
  without one Supabase generates the UUID. The response always contains the persisted row,
  so the client learns generated ids.
- **`?includeInactive=1`.** Every list accepts it. Without it the list is filtered to
  `is_active = true`. With it, the call requires an admin token (`401`/`403` otherwise) and
  inactive rows are included. `GET /api/menu?includeInactive=1` behaves the same way.
- **Reorder.** Every reorder route is `PATCH .../reorder`, is admin-only, and takes
  `{ "orders": [{ "id": "<uuid>", "display_order": 0 }, ...] }`. The body must contain the
  **complete** set of ids in the affected scope (all hero slides; all banners of one
  placement; all footer sections; all links of one section; all sibling categories; all
  siblings of one menu parent). The server renumbers to `0..n-1` in array order and returns
  `200 { "message": "..." }`. A body that omits an id currently present in the scope is
  rejected with
  `400 { "error": "Reorder must include every item in the scope." }`.
  Reorder handlers are registered **before** `/:id` handlers.
- **Ordering in lists.** `orderColumn` ascending, then `created_at` ascending.

### 4.2 Categories — `/api/categories`

| Method | Path                         | Auth   | Response                                                                                                                                                                                                   |
| ------ | ---------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/categories`            | public | `{ categories: [...] }` — flat list, `is_active = true` unless `?includeInactive=1` + admin                                                                                                                |
| GET    | `/api/categories/tree`       | public | `{ categories: [...] }` — nested `children` arrays, each node `{ ...row, children: [...] }`, roots first, siblings ordered by `display_order`                                                              |
| GET    | `/api/categories/path`       | public | `{ category: {...}, ancestors: [...], descendants: [...] }` — **exact** match on the full ancestor path (`?path=electronics/mobiles/smartphones`); `404 { error }` when no row has exactly that path       |
| GET    | `/api/categories/slug/:slug` | public | `{ category: {...}, ancestors: [...], descendants: [...] }` — bare-slug convenience lookup, shallowest match, `category.ambiguous = true` when several rows share the slug. **Not used by the storefront** |
| GET    | `/api/categories/:id`        | public | `{ category: {...} }`                                                                                                                                                                                      |
| POST   | `/api/categories`            | admin  | `201 { message, category }`                                                                                                                                                                                |
| PATCH  | `/api/categories/:id`        | admin  | `200 { message, category }` — partial                                                                                                                                                                      |
| DELETE | `/api/categories/:id`        | admin  | `200 { message }` — cascades to descendants via the FK                                                                                                                                                     |
| PATCH  | `/api/categories/reorder`    | admin  | `200 { message }` — body `{ orders: [{id, display_order}] }`, renumbers one sibling group                                                                                                                  |

`GET /tree`, `GET /path` and `GET /slug/:slug` must be registered before `GET /:id` so
`tree`, `path` and `slug` are not captured as ids; the same applies to `PATCH /reorder`
before `PATCH /:id`. The editor contract (a sibling reorder call from the admin tree editor)
requires the `/reorder` route; its scope is the sibling group identified by the parent of
the ids in the body, and a body mixing parents is rejected with `400`.

**`GET /path?path=<segments>` — the canonical lookup.** The query value is the path after
`/category/`, with no leading or trailing slash: `electronics/mobiles/smartphones`. Resolve
it **exactly**, one segment at a time: take the level-1 row whose `slug` equals segment 1,
then the child of that row whose `slug` equals segment 2, then the child of _that_ row whose
`slug` equals segment 3. The path resolves only when every segment matched at the expected
depth, so `electronics/mobiles/smartphones` names exactly one category and `accessories`
resolves to the root `Accessories` while `electronics/accessories` resolves to the
Electronics child of the same name. Unknown depth, an empty segment, a 4th segment, or a
segment that does not match a child of the previous row all return `404 { error }`. The
response carries `ancestors` (root→parent), `descendants` (all levels below), and
`category.ambiguous` is never set — an exact path cannot be ambiguous.

**`GET /slug/:slug` — convenience only.** Query every row with that `slug` (any level). Pick
exactly one: lowest `level`, then lowest `display_order`. Load `ancestors` by walking
`parent_id` upward (returned root→parent) and `descendants` by selecting rows whose
`parent_id` is in the already-collected set, repeated to a fixed depth of 3. If more than one
row shares the slug, set `category.ambiguous = true` on the returned category; the field is
absent or `false` otherwise. This route exists for diagnostics and for code that already has
a slug and no path; because `Accessories` exists three times and `Watches` twice, the result
depends on the ordering rule rather than on the caller's intent. The storefront therefore
routes on the full path (§5.5) and never calls this route.

**Create body.**

```json
{
  "name": "Smartphones",
  "slug": "smartphones",
  "parent_id": "d2c00000-0000-4000-8000-000000000001",
  "level": 3,
  "description": null,
  "icon": "Layers",
  "image_url": "https://res.cloudinary.com/.../smartphones.jpg",
  "banner_image_url": null,
  "display_order": 0,
  "is_active": true,
  "show_in_nav": true,
  "show_in_homepage": false
}
```

`name` and `slug` are required. `level` is optional: when omitted the server derives it from
`parent_id` (`parent.level + 1`, or `1` when `parent_id` is null). When supplied it must
agree with the parent. `display_order`/`level` are coerced to integers by `toPayload`.
Writable fields are exactly: `name, slug, parent_id, level, description, icon, image_url,
banner_image_url, display_order, is_active, show_in_nav, show_in_homepage`.

**Tree response example.**

```json
{
  "categories": [
    {
      "id": "d1c00000-0000-4000-8000-000000000001",
      "name": "Electronics",
      "slug": "electronics",
      "parent_id": null,
      "level": 1,
      "display_order": 10,
      "is_active": true,
      "show_in_homepage": true,
      "children": [
        { "id": "...", "name": "Mobiles", "slug": "mobiles", "level": 2, "children": [] }
      ]
    }
  ]
}
```

**Path / slug response example.** Both `GET /path` and `GET /slug/:slug` return this shape
(`GET /path` is the exact walk; `GET /slug/:slug` adds `ambiguous` only when needed):

```json
{
  "category": { "id": "...", "name": "Electronics", "slug": "electronics", "level": 1 },
  "ancestors": [],
  "descendants": [{ "id": "...", "name": "Mobiles", "level": 2 }]
}
```

### 4.3 Hero slides — `/api/content/hero`

| Method | Path                        | Auth   | Response                                                               |
| ------ | --------------------------- | ------ | ---------------------------------------------------------------------- |
| GET    | `/api/content/hero`         | public | `{ slides: [...] }`; `?includeInactive=1` + admin returns inactive too |
| GET    | `/api/content/hero/:id`     | public | `{ slide: {...} }`                                                     |
| POST   | `/api/content/hero`         | admin  | `201 { message, slide }` — upsert by `id`                              |
| PATCH  | `/api/content/hero/:id`     | admin  | `200 { message, slide }` — **partial**                                 |
| DELETE | `/api/content/hero/:id`     | admin  | `200 { message }`                                                      |
| PATCH  | `/api/content/hero/reorder` | admin  | `200 { message }` — body `{ orders: [{id, display_order}] }`           |

Writable fields: `badge, title, subtitle, btn_text, btn_path, bg_image_url,
product_image_url, fallback_image_url, bg_gradient, price_text, tag, ribbon_text,
order_index, is_active`. `title` is required on create. `btn_path` defaults to `/products`.
The response row carries `order_index` (see §3.6); the reorder body still uses
`display_order`. The list is ordered by `order_index` ascending.

The key names `slides` / `slide` are preserved from the previous slice so the running
storefront keeps working during the rollout.

### 4.4 Banners — `/api/content/banners`

| Method | Path                           | Auth   | Response                                                                            |
| ------ | ------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| GET    | `/api/content/banners`         | public | `{ banners: [...] }`; optional `?placement=` filter; `?includeInactive=1` + admin   |
| GET    | `/api/content/banners/:id`     | public | `{ banner: {...} }`                                                                 |
| POST   | `/api/content/banners`         | admin  | `201 { message, banner }`                                                           |
| PATCH  | `/api/content/banners/:id`     | admin  | `200 { message, banner }` — partial                                                 |
| DELETE | `/api/content/banners/:id`     | admin  | `200 { message }`                                                                   |
| PATCH  | `/api/content/banners/reorder` | admin  | `200 { message }` — body `{ orders: [{id, display_order}] }`, scope = one placement |

Writable fields: `placement, variant, badge, title, subtitle, highlight, description,
cta_text, cta_path, image_url, bg_image_url, fallback_image_url, bg_gradient, emoji, code,
accent, bg_color, gallery, display_order, is_active, starts_at, ends_at`.

`title` and `placement` are required. `placement` must be one of the three values in §3.4;
anything else is `400`. `gallery` is an array of strings. `starts_at`/`ends_at` are ISO-8601
strings; when both are present `ends_at` must be after `starts_at`. `?placement=` accepts
the same three values; an unknown placement returns an empty list rather than every banner.

Example create body (`home_promo_carousel`):

```json
{
  "placement": "home_promo_carousel",
  "variant": "standard",
  "badge": "END OF SEASON",
  "title": "End of Season Sale",
  "subtitle": null,
  "highlight": "Up to 70% off",
  "description": "Fashion, beauty and home favourites.",
  "cta_text": "Shop the sale",
  "cta_path": "/category/fashion",
  "gallery": [
    "https://res.cloudinary.com/.../sale-1.jpg",
    "https://res.cloudinary.com/.../sale-2.jpg"
  ],
  "display_order": 0,
  "is_active": true,
  "starts_at": "2026-10-20T00:00:00.000Z",
  "ends_at": "2026-10-31T23:59:59.000Z"
}
```

### 4.5 Footer — `/api/content/footer`

| Method            | Path                                   | Auth   | Response                                                                               |
| ----------------- | -------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| GET               | `/api/content/footer`                  | public | `{ sections: [...], links: [...] }`; `?includeInactive=1` + admin                      |
| POST/PATCH/DELETE | `/api/content/footer/sections[/:id]`   | admin  | `{ message, section }` (delete: `{ message }`)                                         |
| POST/PATCH/DELETE | `/api/content/footer/links[/:id]`      | admin  | `{ message, link }` (delete: `{ message }`)                                            |
| PATCH             | `/api/content/footer/sections/reorder` | admin  | `200 { message }` — body `{ orders: [{id, display_order}] }`                           |
| PATCH             | `/api/content/footer/links/reorder`    | admin  | `200 { message }` — body `{ orders: [{id, display_order}] }`, scope = one `section_id` |

**`GET /api/content/footer` shape.** `links` at the top level is the **flat** list of every
link. Each entry of `sections` additionally carries its own nested `links: [...]` array.
Both the storefront and the footer editor read the nested form; the flat list exists for
lookups. Sorting: sections by `display_order` then `column_index`; links by `display_order`.

```json
{
  "sections": [
    {
      "id": "...",
      "heading": "Customer Support",
      "section_type": "links",
      "column_index": 0,
      "display_order": 0,
      "is_active": true,
      "links": [
        {
          "id": "...",
          "section_id": "...",
          "label": "Help Center",
          "href": "/help",
          "display_order": 0,
          "is_active": true
        }
      ]
    }
  ],
  "links": [
    {
      "id": "...",
      "section_id": "...",
      "label": "Help Center",
      "href": "/help",
      "display_order": 0,
      "is_active": true
    }
  ]
}
```

Section writable fields: `heading, section_type, column_index, display_order, is_active`.
`heading` required; `section_type` ∈ `links`, `tags`.
Link writable fields: `section_id, label, href, display_order, is_active`. `section_id`,
`label` and `href` required; `href` must be an https URL or a site-relative path.
The link reorder scope is the set of links sharing the `section_id` of the ids in the body;
the section reorder scope is every section. `PATCH /api/content/footer/links/reorder` is an
addition to the plan's Task 7 route table: the footer editor's per-section up/down control
needs it, and without it every link would have to be re-POSTed to change one position. It
takes the same `{ orders: [...] }` body and follows the same complete-scope rule as §4.1.

### 4.6 Menu — `/api/menu`

| Method | Path                | Auth   | Response                                                                                                                                                                             |
| ------ | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/menu`         | public | bare array of tree roots (unchanged shape) — `?role=` filters by `roles_allowed`; `?includeInactive=1` + admin returns inactive rows too; `?flat=1` returns a flat array (unchanged) |
| GET    | `/api/menu/:id`     | public | `{ item: {...} }`                                                                                                                                                                    |
| POST   | `/api/menu`         | admin  | `200 { message, item }` — upsert by `id`                                                                                                                                             |
| PATCH  | `/api/menu/:id`     | admin  | `200 { message, item }` — partial                                                                                                                                                    |
| DELETE | `/api/menu/:id`     | admin  | `200 { message }`                                                                                                                                                                    |
| PATCH  | `/api/menu/reorder` | admin  | body `{ orders: [{id, display_order, parent_id, level}] }` — renumbers siblings                                                                                                      |

Writable fields: `title, path, icon, parent_id, level, section, section_icon, badge,
badge_variant, roles_allowed, order_index, is_active, promo_title, promo_subtitle,
promo_image_url, promo_cta_text, promo_cta_path, category_id`.

Rules:

- `title` and `path` are required on create; `icon` defaults to `Layers`; `level` defaults
  to 1; `roles_allowed` defaults to all four roles.
- Depth rules match the categories: level 1 has no parent, level 2 needs a level-1 parent,
  level 3 needs a level-2 parent, nothing deeper.
- `category_id`, when present, must reference an existing `categories` row, else
  `400 { error: "Category not found." }`.
- `POST` returns the persisted row and a Supabase error must surface as
  `500 { error }` — it must not be `console.warn`ed while returning `200`.
- `PATCH` returns the persisted row and writes only the keys sent.
- Reorder renumbers the sibling group under one `parent_id`, writing the new indices to
  `order_index`; entries may carry `parent_id`/`level` for a move to another parent.
- The admin client calls `PATCH` for edits; `PUT /api/menu/:id` is not required. The old
  `MenuListEditor` that issued `PUT` is deleted (§6).

### 4.7 Products bound to the taxonomy

| Call                                            | Behaviour                                                                                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/products?categoryPath=<a/b/c>`        | Resolve the path exactly as `GET /api/categories/path` does, expand to that category plus all descendants, and filter `products.category_id` with `.in("category_id", ids)`.                   |
| `GET /api/products?categoryPath=<unknown path>` | `200` with an empty array **and** the response header `X-Category-Not-Found: true`, so the client can distinguish "empty category" from "no such category".                                    |
| `GET /api/products?categoryId=<uuid>`           | Resolve the id and expand to that category plus all descendants, exactly like `categoryPath`; the two parameters are alternative spellings of the same taxonomy filter.                        |
| `GET /api/products?category=<free text>`        | Unchanged legacy behaviour: `ilike("category", <free text>)` against the display label. It is **not** a taxonomy filter and never resolves through `categories`.                               |
| `GET /api/products` (no category param)         | No query against `categories` is issued.                                                                                                                                                       |
| `POST /api/products`, `PUT /api/products/:id`   | Accept an optional `category_id`. If it is supplied and `category` text is absent, set `category` to the category's `name`. If the id does not exist → `400 { error: "Category not found." }`. |
| `GET /api/products?search=<term>`               | Escape `,` `.` `(` `)` to spaces before interpolating into the PostgREST `.or(...)` expression.                                                                                                |

**There is no bare-slug taxonomy filter.** An earlier draft resolved `?category=<slug>`
against `categories` with "lowest `level`, then lowest `display_order`", which silently sent
`electronics/accessories` to the root `Accessories` page and `fashion/accessories/watches` to
the `accessories/watches` page. Taxonomy filtering is now named twice on purpose —
`categoryPath` (what the storefront sends) and `categoryId` (what the admin and vendor forms
send) — and both resolve to one id and expand descendants. `?category=<text>` stays only
because the vendor dashboard still writes free-text categories; it keeps its existing
`ilike` semantics and must not be used for taxonomy navigation.

The client also resolves the path locally against `useContent().categoryTree` before calling
the API (§5.5), so a tree hit needs no round trip.

### 4.8 Validation rules and exact error strings

Validators are pure functions in `server/lib/validation.js`. Each returns `null` or a
message; the route returns `400 { error: message }`. With `{ partial: true }` required-field
checks are skipped and only present fields are validated.

| Validator               | Rule                                                                                                                     | Error string                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isHttpsOrRelative`     | `null`/`""` allowed; otherwise must start with `/` or `https://`                                                         | `Field '<field>' must be an https URL or a relative path.`                                                                                                                     |
| `validateHeroSlide`     | `title` required                                                                                                         | `Hero slide title is required.`                                                                                                                                                |
| `validateHeroSlide`     | `order_index` integer                                                                                                    | `order_index must be an integer.`                                                                                                                                              |
| `validateCategory`      | `name` required                                                                                                          | `Category name is required.`                                                                                                                                                   |
| `validateCategory`      | `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$`                                                                                | `slug must be lowercase letters, numbers and hyphens only.`                                                                                                                    |
| `validateCategory`      | `level` integer 1–3                                                                                                      | `Category level must be an integer between 1 and 3.`                                                                                                                           |
| `validateDepth`         | level > 1 without parent                                                                                                 | `parent_id is required for categories below level 1.`                                                                                                                          |
| `validateDepth`         | level 1 with parent                                                                                                      | `Level 1 categories must not have a parent_id.`                                                                                                                                |
| `validateDepth`         | parent level ≠ `level - 1`                                                                                               | `Parent category must be at level 2 for a level 3 category.` / `Parent category must be at level 1 for a level 2 category.`                                                    |
| `validateDepth`         | parent id not found                                                                                                      | `Parent category not found.`                                                                                                                                                   |
| `validateBanner`        | `title` required                                                                                                         | 400 naming the missing field                                                                                                                                                   |
| `validateBanner`        | `placement` required and one of three                                                                                    | `Banner placement is required.` (missing) / 400 naming the allowed values (invalid)                                                                                            |
| `validateBanner`        | `cta_path`, `image_url`, `bg_image_url`, `fallback_image_url` https-or-relative                                          | `Field '<field>' must be an https URL or a relative path.`                                                                                                                     |
| `validateBanner`        | `starts_at`/`ends_at` ISO-8601; `ends_at > starts_at`                                                                    | 400 naming the field                                                                                                                                                           |
| `validateFooterSection` | `heading` required                                                                                                       | `Footer section heading is required.`                                                                                                                                          |
| `validateFooterLink`    | `label` required                                                                                                         | 400 naming the field                                                                                                                                                           |
| `validateFooterLink`    | `href` required, https-or-relative                                                                                       | `Footer link href is required.`                                                                                                                                                |
| menu                    | `title` and `path` required                                                                                              | `Menu item title and path are required.`                                                                                                                                       |
| menu                    | level 1–3, parent level exactly `level - 1`                                                                              | `Menu level must be an integer between 1 and 3.` / `Parent level must be 1 for a level 2 item.` / `Parent level must be 2 for a level 3 item.` / `Parent menu item not found.` |
| `slugify`               | lowercase, then replace every run of characters outside `[a-z0-9]` with a single `-`, then trim leading and trailing `-` | pure function, no error                                                                                                                                                        |

`slugify` reference cases: `"Men's Fashion"` → `men-s-fashion`; `"Home & Kitchen"` →
`home-kitchen`; `"TVs"` → `tvs`. The apostrophe and the space in the first case are two
separate runs of non-alphanumeric characters, so each becomes its own `-`; that matches the
seeded path segment `men-s-fashion` (§3.2, §7.1).

### 4.9 Route registration and mounting

`server/app.js` mounts, inside the existing router block and **before** the `/api/*` 404
catch-all: `/api/auth`, `/api/menu`, `/api/content`, `/api/content/banners`,
`/api/content/footer`, `/api/categories`, `/api/users`, `/api/products`, `/api/orders`,
`/api/upload`. The three new mounts are `bannerRoutes`, `footerRoutes` and
`categoriesRoutes`; the import names and mount order are the only additions.

Until the storefront migrates to `/api/categories` (Task 13 of the plan),
`server/routes/content.js` keeps this temporary alias so the running app does not break while
`site_categories` is dropped:

```js
// TEMPORARY (removed in Task 13): the storefront still calls the old path.
router.get("/categories", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data ?? [] });
});
```

The alias is deleted in the same task that deletes the last old-path caller.

## 5. Client Architecture

### 5.1 `src/api/client.js`

```js
export const API_BASE_URL = "/api";
export function getStoredToken(): string | null;
export function setStoredToken(token: string | null): void;
export function onUnauthorized(listener: (status: number) => void): () => void;
export async function apiFetch(path, options?: {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  formData?: FormData,
  auth?: boolean,          // default true
}): Promise<any>;
```

- Token lives in `localStorage["marvel_jwt_token"]`. `auth !== false` and a token present →
  `Authorization: Bearer <token>`.
- `Content-Type: application/json` is set only when a JSON `body` exists; a `FormData` body
  never gets a `Content-Type` (the browser adds the boundary).
- 2xx → parsed JSON (or `undefined` for `204`). Non-2xx → **throws** an `Error` whose
  `.message` is the server's `error` string (fallback `Request failed with status <n>`),
  with `.status` and `.body` attached. It never returns `[]` or `null` to paper over a
  failure.
- A `401` notifies every `onUnauthorized` listener exactly once for that response.

`AuthContext` registers a listener that clears the token, resets the user and routes to
`#/login`; the effect returns the unsubscribe function. This is the only global 401 handler
in the app.

### 5.2 `src/api/contentApi.js`

A thin transport layer over `apiFetch` — one function per operation, `URLSearchParams` for
queries, no state, no caching:

```js
apiFetchHeroSlides(opts?: { includeInactive?: boolean }): Promise<{ slides: HeroSlide[] }>
apiSaveHeroSlide(slide: object): Promise<{ slide: HeroSlide }>
apiUpdateHeroSlide(id: string, patch: object): Promise<{ slide: HeroSlide }>
apiDeleteHeroSlide(id: string): Promise<{ message: string }>
apiReorderHeroSlides(orders: { id: string; display_order: number }[]): Promise<{ message: string }>
apiFetchCategories(opts?: { includeInactive?: boolean }): Promise<{ categories: Category[] }>
apiFetchCategoryTree(opts?: { includeInactive?: boolean }): Promise<{ categories: CategoryNode[] }>
apiFetchCategoryBySlug(slug: string): Promise<{ category: Category; ancestors: Category[]; descendants: Category[] }>
apiFetchCategoryByPath(path: string): Promise<{ category: Category; ancestors: Category[]; descendants: Category[] }>
apiSaveCategory(c: object): Promise<{ category: Category }>
apiUpdateCategory(id: string, patch: object): Promise<{ category: Category }>
apiDeleteCategory(id: string): Promise<{ message: string }>
apiReorderCategories(orders: { id: string; display_order: number }[]): Promise<{ message: string }>
apiFetchBanners(opts?: { includeInactive?: boolean; placement?: string }): Promise<{ banners: Banner[] }>
apiSaveBanner(b: object): Promise<{ banner: Banner }>
apiUpdateBanner(id: string, patch: object): Promise<{ banner: Banner }>
apiDeleteBanner(id: string): Promise<{ message: string }>
apiReorderBanners(orders: { id: string; display_order: number }[]): Promise<{ message: string }>
apiReorderFooterSections(orders: { id: string; display_order: number }[]): Promise<{ message: string }>
apiReorderFooterLinks(orders: { id: string; display_order: number }[]): Promise<{ message: string }>
apiFetchFooter(opts?: { includeInactive?: boolean }): Promise<{ sections: FooterSection[]; links: FooterLink[] }>
apiSaveFooterSection(s: object): Promise<{ section: FooterSection }>
apiUpdateFooterSection(id: string, patch: object): Promise<{ section: FooterSection }>
apiDeleteFooterSection(id: string): Promise<{ message: string }>
apiSaveFooterLink(l: object): Promise<{ link: FooterLink }>
apiUpdateFooterLink(id: string, patch: object): Promise<{ link: FooterLink }>
apiDeleteFooterLink(id: string): Promise<{ message: string }>
apiFetchMenuItems(role?: string, opts?: { includeInactive?: boolean }): Promise<MenuNode[]>
apiSaveMenuItem(item: object): Promise<{ item: MenuNode }>
apiUpdateMenuItem(id: string, patch: object): Promise<{ item: MenuNode }>
apiDeleteMenuItem(id: string): Promise<{ message: string }>
apiReorderMenuItems(orders: { id: string; display_order: number; parent_id?: string | null; level?: number }[]): Promise<{ message: string }>
apiUploadImage(file: File, folder?: string): Promise<{ url: string; public_id: string }>
```

`apiFetchMenuItems` returns the bare array from `GET /api/menu`. `apiUploadImage` posts
multipart form data to `/upload` and returns the endpoint's `url` — never a `signed_url`
key, which does not exist.

Each function maps one-to-one onto the routes in §4: `apiFetch*` → `GET <base>`,
`apiSave*` → `POST <base>`, `apiUpdate*` → `PATCH <base>/:id`, `apiDelete*` →
`DELETE <base>/:id`, `apiReorder*` → `PATCH <base>/reorder`. The bases are `/categories`,
`/content/hero`, `/content/banners`, `/content/footer/sections`, `/content/footer/links`
and `/menu`. Query strings are built with `URLSearchParams` (`includeInactive=1`,
`placement`, `role`, `path`). The two category exceptions are
`apiFetchCategoryBySlug` → `GET /categories/slug/:slug` and `apiFetchCategoryByPath` →
`GET /categories/path?path=<segments>`.

### 5.3 `src/context/ContentContext.jsx`

```js
export function ContentProvider({ children }) : JSX.Element;
export function useContent(): {
  hero: HeroSlide[],
  banners: Banner[],
  categories: Category[],          // flat, active only
  categoryTree: CategoryNode[],    // nested, active only
  footer: { sections: FooterSection[]; links: FooterLink[] },
  menu: MenuNode[],
  loading: boolean,                // true until the first load settles
  error: string | null,            // first failure message
  refresh: () => Promise<void>,
};
```

- Loads hero, banners, categories (flat and tree), footer and menu once on mount, in
  parallel, each in its own `try/catch`, so one failed collection does not blank the others.
- **Never throws.** A failure sets `error` and leaves that collection empty. A late response
  after unmount is discarded (`cancelled` flag).
- `refresh()` re-runs the whole loader and is exposed for the admin "preview after edit"
  path.
- Listens for the `window` event `marvel_content_updated` (dispatched by every admin editor
  after a successful write) and calls `refresh()`. The listener is removed on unmount.
- Mounted above `AuthProvider` in `App.jsx` (content does not depend on auth, but the admin
  menu preview does):

```jsx
<ToastProvider>
  <ContentProvider>
    <AuthProvider>
      <CartProvider>
        <AppMain />
```

### 5.4 Storefront consumers

| Component                | Reads                                                 | Behaviour                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HeroBanner`             | `hero`                                                | Renders slides in order; CTA navigates to `btn_path` (currently mapped but unused). Empty → one inline emergency slide defined in the component (the only static fallback kept). |
| `CategorySlider`         | `categories` filtered to `show_in_homepage === true`  | Click navigates to `#/category/<full ancestor path>` (the root's slug; a root has a one-segment path). Categories without the flag are excluded.                                 |
| `BannerLayout`           | `banners` where `placement === "home_banner_layout"`  | Sorts by `display_order`; `variant === "large"` fills the large slot, `small` the two small slots; fewer than 3 banners renders only what exists.                                |
| `PromoBannerCarousel`    | `banners` where `placement === "home_promo_carousel"` | Renders `gallery` images; countdown computed from `ends_at` when present, otherwise the existing literal.                                                                        |
| `Footer`                 | `footer.sections` + nested `links`                    | Renders columns and the `section_type === "tags"` block. Value-prop bar, social block, payment chips and copyright stay in code.                                                 |
| `HoverNav`               | `menu`                                                | No fetch of its own; keeps its distinct layout.                                                                                                                                  |
| `navigation/DynamicMenu` | `menu`                                                | No fetch, no `data.js` fallback; keeps `normalizeToTree` for a flat response.                                                                                                    |
| `BrowseCategoriesMenu`   | `categoryTree`                                        | Renders roots with children; no `data.js`.                                                                                                                                       |
| `MobileMenu`             | `categoryTree`                                        | Same tree, mobile presentation.                                                                                                                                                  |

When `useContent().error` is set, every surface renders an explicit, visible empty/error
state. A surface must never render as if the content were genuinely empty when the load
failed. No component outside `HeroBanner` keeps a static content fallback.

### 5.5 Category routing and `CategoryPage`

- Hash route `#/category/electronics/mobiles/smartphones`: the route carries the **whole
  ancestor path**, not a slug. `getHashRoute` recognises a first segment of `category`, then
  takes everything after it — `parts.slice(1).join("/")`, URL-decoded — as `path`, and
  strips a leading or trailing `/`. For `#/category/electronics/mobiles/smartphones` it
  returns `{ page: "category", path: "electronics/mobiles/smartphones" }` alongside the
  existing `id` and `full` fields, which keep serving `product/:id`. It must not stop at
  `parts[1]`. The current silent bounce of `category/*` to the homepage is removed.
- `handleDynamicMenuClick` maps a nav path to the route by string equality: `menu_items.path`
  is already the full path (`/category/electronics/mobiles/smartphones`), so strip the
  leading `/category/` and append the remainder to `#/category/`. The menu path and the
  category path are the same string, so there is nothing to resolve and nothing to drift.
  Paths that are not under `/category/` keep their existing handling in that function.
- **Local resolution.** `CategoryPage` resolves the path against
  `useContent().categoryTree` by computing each node's ancestor-joined path (root slug, then
  `parentPath + "/" + slug`) and matching exactly. A tree hit needs no request. On a miss it
  calls `apiFetchCategoryByPath(path)`; a `404` puts the page in its unknown-category state
  instead of bouncing home. A bare slug is never used for resolution; `Accessories` exists
  three times, so a last-segment lookup cannot name the category the visitor clicked.
- `CategoryPage` props: `{ path }`. It fetches products with `{ categoryPath: path }`
  (§4.7), so the product set is the resolved category plus its descendants, and renders:
  - breadcrumb `Home / <ancestor names> / <category name>` built from the resolved
    `ancestors`,
  - category name and description,
  - subcategory chips from the resolved node's direct `children` (equivalently
    `descendants` at `category.level + 1`), each navigating to
    `#/category/<path>/<child slug>` — the full path, not the child slug alone,
  - a `ProductCard` grid.
- Loading, empty ("No products in this category yet."), unknown-category and error states
  are distinct and visible.

### 5.6 Removal of the old content layer

After the surfaces migrate, `src/data.js` and the **nine** storefront components that exist
only to render its static content are deleted. The exact list, so the count is checkable:

1. `src/components/Navbar.jsx`
2. `src/components/Sidebar.jsx`
3. `src/components/CategoryScroll.jsx`
4. `src/components/VerticalCategoryMenu.jsx`
5. `src/components/PromoBanners.jsx`
6. `src/components/FeatureBanners.jsx`
7. `src/components/SaleBanner.jsx`
8. `src/components/ProductSection.jsx`
9. `src/components/ui/MegaMenu.jsx`

Nine components plus `src/data.js` is ten deleted files on the storefront side. The four
admin-side deletions (`admin/MenuListEditor.jsx`, `admin/CategoriesEditor.jsx`,
`admin/AdminDashboard.jsx`, `admin/charts/SalesGrowthCard.jsx`) are covered in §6.3, and
`src/api/backendApi.js` shrinks to the auth, product, cart and upload helpers still in use.
No file under `src/` may import `data.js` at the end of the feature; each deletion is
preceded by a grep for its importers so the build cannot break on a dangling import.

## 6. Admin UX

### 6.1 Editor kit — `src/components/admin/ContentEditorKit.jsx`

Four primitives in one file, used by all editors:

| Component       | Props                                             | Contract                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ImageField`    | `label, value, onChange(url \| null), folder`     | Shows the current URL, an Upload button that opens the existing `ImageUploadDropzone`, and a Clear button. Uploads through `apiUploadImage` and calls `onChange` with the returned `url`. Displays the upload error inline and does not call `onChange` on failure. Never labels the value "signed_url". |
| `OrderControls` | `index, total, onMove(from, to)`                  | Up/down buttons, `aria-label`s "Move up"/"Move down", disabled at index 0 and `total - 1`.                                                                                                                                                                                                               |
| `ActiveToggle`  | `active, onChange(active)`                        | Button with `aria-pressed`; calls back with the inverted value.                                                                                                                                                                                                                                          |
| `EditorTable`   | `columns, rows, onEdit, onDelete, onToggleActive` | Table with a header row from `columns`, one row per item, Edit, Delete (opens `ConfirmDialog`) and `ActiveToggle` per row.                                                                                                                                                                               |

All four are keyboard reachable and have accessible names; the kit is the only place these
controls are implemented.

### 6.2 The four editors, plus the menu editor fix

The four editors that carry this feature are `CategoriesTreeEditor`, `BannersEditor`,
`FooterEditor` and `HeroSlidesEditor`. `MenuTreeEditor` already exists; it is fixed and
mounted in the same slice because the menu is now bound to the taxonomy. Their files:

| Piece                  | File                                            | Status                                                    |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| `CategoriesTreeEditor` | `src/components/admin/CategoriesTreeEditor.jsx` | new, replaces `src/components/admin/CategoriesEditor.jsx` |
| `BannersEditor`        | `src/components/admin/BannersEditor.jsx`        | new                                                       |
| `FooterEditor`         | `src/components/admin/FooterEditor.jsx`         | new                                                       |
| `HeroSlidesEditor`     | `src/components/admin/HeroSlidesEditor.jsx`     | existing, refactored                                      |
| `MenuTreeEditor`       | `src/components/admin/MenuTreeEditor.jsx`       | existing, fixed and mounted                               |
| Editor kit (shared)    | `src/components/admin/ContentEditorKit.jsx`     | new (§6.1)                                                |
| `CategoryPicker`       | `src/components/admin/CategoryPicker.jsx`       | new, used by the admin and vendor product forms (§2.1)    |

**`CategoriesTreeEditor`** (replaces `CategoriesEditor`)

- Loads `apiFetchCategoryTree({ includeInactive: true })`; "Show hidden" toggles whether
  `is_active: false` rows are rendered.
- Every node shows Add subcategory (disabled at level 3), Edit, Delete, up/down within its
  sibling group.
- Form fields: `name` (required), `slug` (a new row's field is prefilled with
  `slugify(name)` and stops following `name` as soon as the admin edits the slug; an existing
  row keeps its stored slug until the admin changes it), `parent_id` (select of valid parents:
  none for level 1, level-1 rows for level 2, level-2 rows for level 3), `icon`, `image_url`
  (ImageField), `banner_image_url` (ImageField), `description`, `display_order`
  (OrderControls), `is_active` (ActiveToggle), `show_in_nav`, `show_in_homepage`.
- `level` is derived from the selected parent (`parent.level + 1`, else 1).
- Editing sends `apiUpdateCategory(id, patch)` with only changed fields; creating sends
  `apiSaveCategory` with the full form payload. The payload always includes every field the
  form owns, so no field (for example `show_in_homepage`) is silently dropped.
- Reorder sends the complete ordered sibling list to `apiReorderCategories`.
- Changing a saved category's `slug` shows an inline warning that its path — and every
  descendant's path, which contains that segment — changes with it, so existing links to the
  old URL stop resolving (no redirect map in this slice). Changing only the `name` does not
  change any path.
- Delete is behind a `ConfirmDialog` that states how many descendants will also be deleted.
- A failed save shows a toast and leaves the form open; the form closes only after success.
- On success: toast, refetch, `window.dispatchEvent(new Event("marvel_content_updated"))`.

**`BannersEditor`**

- Three placement tabs: `home_banner_layout`, `home_promo_carousel`, `promo_strip`. Each tab
  lists `apiFetchBanners({ placement, includeInactive: true })`.
- `home_banner_layout`: `title, subtitle, cta_text, cta_path, image_url, variant`
  (`large` | `small`), `display_order`, `is_active`.
- `home_promo_carousel`: `badge, title, highlight, description, cta_text, cta_path,
gallery` (each URL added through `ImageField`), `display_order`, `is_active`, `ends_at`
  (`datetime-local`, sent as ISO).
- `promo_strip`: `title, subtitle, emoji, code, accent, bg_color, cta_text, cta_path,
display_order, is_active`.
- Creating asks for `placement`; changing it reloads the list. Edits use
  `apiUpdateBanner(id, patch)`; reorder uses `apiReorderBanners` with one placement's full
  list. Failed save → toast, form stays open.

**`FooterEditor`**

- Left pane: sections (`heading, section_type, column_index, display_order, is_active`) with
  add/edit/delete and section reorder.
- Right pane: the selected section's links (`label, href, display_order, is_active`) with
  add/edit/delete and up/down ordering. A new link is sent with that section's `section_id`.
- Deleting a section confirms and states that its links are deleted too (FK cascade).
- Link reorder calls `apiReorderFooterLinks` with the complete list for that section.

**`HeroSlidesEditor`** (refactored, not rewritten)

- Table/cards of slides with a preview thumbnail, order controls, active toggle and delete
  confirmation.
- Image inputs become `ImageField` (replacing the mislabeled "paste signed_url" fields);
  up/down ordering replaces the raw numeric input.
- Edits use `apiUpdateHeroSlide(id, patch)`; creates use `apiSaveHeroSlide`.
- Required-title validation and the delete confirmation are kept.

**`MenuTreeEditor`** (fixed and mounted)

- Sends `is_active` and `badge_variant` on save; uses `apiUpdateMenuItem` for edits and
  `apiSaveMenuItem` for creates; reorder sends the complete sibling list.
- Gains a `category_id` select fed by `apiFetchCategoryTree()`, filtered to levels 2 and 3.
  Choosing a category derives `path` to the category's full path
  (`/category/<ancestor slugs>/<slug>`).
- Dispatches `marvel_menu_updated` (kept for compatibility) and `marvel_content_updated`
  after every successful write.
- Delete confirmation text must match what the API does (the row's children cascade), not
  claim a different behaviour.

### 6.3 Four coordinated wiring points in `UnifiedAdminConsole.jsx`

There is no tab registry; a new Site Content editor needs **all four** edits or it will not
appear, or will appear without its label/sidebar entry:

1. **Import** the editor in the admin component import block (`:82-84`).
2. **`TAB_LABELS`** entry (`:768-777`): `categories: "Site Content — Categories"`,
   `banners: "Site Content — Banners"`, `footer: "Site Content — Footer"`, and the menu tab
   label.
3. **Sidebar**: add the submenu button in the Site Content group (`:1106-1139`) and add the
   key to the parent's active-check array (`:1088`/`:1101`, currently
   `["menus","hero","categories"]`) so the group stays expanded and highlighted.
4. **Render block** (`:2337-2345`):
   `{activeTab === "banners" && canManageSiteContent && <BannersEditor />}`, the same for
   `footer` and `categories`, and `<MenuTreeEditor role={isSuperAdmin ? "super_admin" :
currentRole || "admin"} />` at `:2338` replacing `<MenuListEditor />`.

Deleting a replaced editor (`MenuListEditor`, `CategoriesEditor`, `AdminDashboard`,
`charts/SalesGrowthCard`) requires removing its import in the same change; a dangling import
fails the build.

## 7. Seed Data Strategy

Everything ships populated. There is no empty state on first load of a fresh database.

### 7.1 Categories come from the menu tree (migration `20261020000008`)

The `categories` rows are generated from `menu_items` so the two trees cannot drift. The
category id **is** the menu item id, which makes the linkage (`menu_items.category_id`)
exact and lets the seed be a no-op on re-run.

**Only the mega-menu rows are taxonomy.** `menu_items` also holds the six flat navigation
rows seeded by `20260822000000_init_schema.sql:143-151` — `Home & Shop` (`/`),
`Electronics & Tech` (`/category/electronics`), `Fashion & Lifestyle`
(`/category/fashion`), `Vendor Portal`, `Admin Panel` and `Super Admin System`. They are
level 1 with `parent_id IS NULL` and random ids. They are **navigation-only rows with no
category**: they keep `category_id IS NULL`, they are not part of the taxonomy, and they
must never be copied into `categories`. Selecting them would (a) collide with
`categories_slug_root_unique` on `electronics`, making the surviving row heap-order
dependent and either aborting the insert on the `parent_id` FK or silently dropping the real
roots, (b) create a level-1 category with an empty slug from the `/` path, violating the
slug rule and the `^[a-z0-9]+(-[a-z0-9]+)*$` validator, and (c) turn the three dashboard
entries into categories.

The mega-menu migration gives every taxonomy row a fixed id whose first three characters
encode its depth — `d1c…` (level 1), `d2c…` (level 2), `d3c…` (level 3), e.g.
`d1c00000-0000-4000-8000-000000000001`. The prefix is the discriminator: inserting level by
level also guarantees that a level-2 row's parent exists before the FK is checked.

```sql
-- 1. Level-1 roots. Level-2 rows reference these ids.
INSERT INTO public.categories (id, name, slug, parent_id, level, display_order, is_active, show_in_nav, show_in_homepage)
SELECT m.id, m.title,
       lower(regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')),
       NULL, 1, COALESCE(m.order_index, 0), COALESCE(m.is_active, true), true, true
FROM public.menu_items m
WHERE m.id::text LIKE 'd1c%' AND m.level = 1
ON CONFLICT DO NOTHING;

-- 2. Level-2 subcategories.
INSERT INTO public.categories (id, name, slug, parent_id, level, display_order, is_active, show_in_nav, show_in_homepage)
SELECT m.id, m.title,
       lower(regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')),
       m.parent_id, 2, COALESCE(m.order_index, 0), COALESCE(m.is_active, true), true, false
FROM public.menu_items m
WHERE m.id::text LIKE 'd2c%' AND m.level = 2
ON CONFLICT DO NOTHING;

-- 3. Level-3 leaves.
INSERT INTO public.categories (id, name, slug, parent_id, level, display_order, is_active, show_in_nav, show_in_homepage)
SELECT m.id, m.title,
       lower(regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')),
       m.parent_id, 3, COALESCE(m.order_index, 0), COALESCE(m.is_active, true), true, false
FROM public.menu_items m
WHERE m.id::text LIKE 'd3c%' AND m.level = 3
ON CONFLICT DO NOTHING;
```

`COALESCE` is required: `menu_items.order_index` and `menu_items.is_active` are nullable
(`20260822000000:41,43`), while `categories.display_order` and `categories.is_active` are
`NOT NULL`. The `lower(...)` keeps the stored slug inside the lowercase slug rule even though
the path segment may contain capitals.

The slug is the **last** path segment: strip everything up to and including the final `/`,
lowercase it, then replace every run of characters outside `[a-zA-Z0-9-]` with a single
hyphen. That is correct for every level:

- level 1 `/category/electronics` → `electronics`
- level 2 `/category/electronics/mobiles` → `mobiles`
- level 3 `/category/electronics/mobiles/smartphones` → `smartphones`
- `Men's Fashion`'s segment `/category/fashion/men-s-fashion` → `men-s-fashion` (the slug is
  the existing path segment, not a re-slugified name — §3.2)

A fixed `split_part(m.path, '/', 4)` is **not** usable: splitting `/category/a/b/c` on `/`
gives parts `''`, `category`, `a`, `b`, `c`, so part 4 is the empty string for a level-1
path and the _parent_ (`b`) for a level-3 path. The same defect applies to
`split_part(..., '/', 3)` on the `/category/`-stripped path, which is empty for level 1 and
level 2. The regexp form above has no fixed-index assumption.

**Count guard.** A corrupted tree must abort the migration, never apply partially:

```sql
DO $$
DECLARE
  expected_roots INT; expected_l2 INT; expected_l3 INT;
  actual_roots INT; actual_l2 INT; actual_l3 INT; orphan_count INT; empty_slug_count INT;
BEGIN
  SELECT count(*) FILTER (WHERE id::text LIKE 'd1c%'),
         count(*) FILTER (WHERE id::text LIKE 'd2c%'),
         count(*) FILTER (WHERE id::text LIKE 'd3c%')
    INTO expected_roots, expected_l2, expected_l3
    FROM public.menu_items;
  SELECT count(*) FILTER (WHERE level = 1),
         count(*) FILTER (WHERE level = 2),
         count(*) FILTER (WHERE level = 3)
    INTO actual_roots, actual_l2, actual_l3
    FROM public.categories
   WHERE id::text LIKE 'd1c%' OR id::text LIKE 'd2c%' OR id::text LIKE 'd3c%';
  SELECT count(*) INTO orphan_count FROM public.categories WHERE level > 1 AND parent_id IS NULL;
  SELECT count(*) INTO empty_slug_count FROM public.categories WHERE slug IS NULL OR slug = '';
  IF actual_roots <> expected_roots OR actual_l2 <> expected_l2 OR actual_l3 <> expected_l3 THEN
    RAISE EXCEPTION 'categories seed mismatch: expected %/%/%, got %/%/%',
      expected_roots, expected_l2, expected_l3, actual_roots, actual_l2, actual_l3;
  END IF;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'categories seed produced % orphan rows above level 1', orphan_count;
  END IF;
  IF empty_slug_count > 0 THEN
    RAISE EXCEPTION 'categories seed produced % rows with an empty slug', empty_slug_count;
  END IF;
END $$;
```

`expected_*` is read from `menu_items` at apply time, so the guard compares the inserted tree
against the live seed rather than a hard-coded number and stays correct when the mega-menu
seed grows. The three checks are independent: the per-level counts catch a dropped,
duplicated or wrong-depth insert; `orphan_count` catches a row whose parent insert failed
(the `parent_id` FK is immediate, so this is belt-and-braces); `empty_slug_count` catches a
row whose path had no last segment (for example `Home & Shop`, whose `/` path yields `''`)
if such a row ever enters `categories`. `count(*) FILTER (…)` and `SELECT … INTO` with
several aggregates are valid PL/pgSQL. The guard runs after the three inserts and before the
backfills, which cannot change `level`, `parent_id` or `slug`; each message reports the
counts involved (the mismatch message quotes expected and actual per level), so a failed
apply reports the defect instead of leaving a half-built tree.

Then link the rows back and backfill the display data:

```sql
UPDATE public.menu_items m SET category_id = c.id
FROM public.categories c
WHERE c.id = m.id;

UPDATE public.categories
SET show_in_homepage = (
  level = 1 AND name IN (
    'Electronics', 'Fashion', 'Home & Kitchen', 'Beauty',
    'Sports', 'Toys & Baby', 'Accessories'
  )
);

UPDATE public.categories c
SET image_url = s.image_url
FROM public.site_categories s
WHERE lower(s.name) = lower(c.name)
  AND c.image_url IS NULL;

UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE c.id = (
  SELECT c2.id
  FROM public.categories c2
  WHERE lower(c2.name) = lower(p.category)
  ORDER BY c2.level ASC, c2.display_order ASC, c2.id ASC
  LIMIT 1
);
```

Notes:

- The seven level-1 roots are the homepage strip. The approved wording named
  "Sports & Fitness"; the seeded root's title is "Sports", so the statement above uses the
  title that exists. If the seed title changes, this statement must change with it.
- The `menu_items.category_id` link covers only the taxonomy rows, because only those have
  a `categories` row with the same id; the six legacy rows keep `category_id IS NULL` by
  construction.
- `image_url` matching is by case-insensitive name. Of the 10 legacy `site_categories` rows,
  only 7 have a matching menu title and are therefore migrated into `categories`:
  "Mobiles", "Laptops", "Headphones", "Watches", "Bags", "Cameras" and "Gaming". "TVs",
  "Shoes" and "Perfumes" exist only as homepage category-slider circles in `site_categories`
  and `src/data.js`; they match no category row, so their images are simply not used and the
  UI falls back to a per-root image. Unmatched categories keep `image_url = NULL`.
- `products.category_id` binds to exactly one row, ordered by lowest `level`, then lowest
  `display_order`, then `id`. That resolves `Accessories` (root, under Electronics, under
  Fashion) to the root, and separates same-level twins such as `Ethnic Wear` (men's leaf at
  `display_order` 5, women's leaf at 4 → the women's leaf). The `id` term is the final
  tiebreak, so two rows sharing level _and_ order cannot make the update non-deterministic.
  Products that match nothing keep `category_id = NULL` and their `category` text; the
  product seed (§7.3) rewrites them onto real categories.
- `site_categories` is **not** dropped here. The storefront still reads it through the old
  path until the replacement API and alias exist; the drop is its own migration (§9).

### 7.2 Content seeds (`server/seed_content.js`, `npm run seed:content`)

Idempotent and non-destructive: `upsert(rows, { onConflict: "id" })` with fixed literal
UUIDs, never `delete`. Running it twice must not change any row count.

| Builder                        | Output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildCategorySeeds(menuRows)` | 3-level category rows with `id` = the menu row's `id`, `slug` = the last path segment, `parent_id` = the parent menu row's id, `level` preserved. It writes exactly `id, name, slug, parent_id, level, display_order, is_active, show_in_nav`. It does **not** write `show_in_homepage` — that column is owned by the migration-8 rule, which the seed must not clear — and it does not write `description`, `icon`, `image_url` or `banner_image_url`, which are admin-owned. Because the ids match migration 8, this is a no-op on an already-seeded database and a repair path if a category is missing. |
| `buildBannerSeeds()`           | 9 banners: 1 `home_banner_layout` with `variant: "large"`, 2 with `variant: "small"`, 3 `home_promo_carousel`, 3 `promo_strip`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `buildFooterSeeds()`           | 5 sections with 6, 6, 6, 6 and 10 links (34 total).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Banner titles, in order: `"Make Your Home Beautiful"`, `"Style That Speaks"`,
`"Beauty for You"` (`home_banner_layout`); `"End of Season Sale"`,
`"Electronics Mega Sale"`, `"Style Redefined"` (`home_promo_carousel`);
`"Big Savings Days"`, `"Extra 10% Off"`, `"No Cost EMI"` (`promo_strip`).

Footer sections: `"Customer Support"`, `"Policy & Legal"`, `"My Account"`, `"Popular
Categories"` (each `section_type: "links"`, 6 links) and `"Popular Searches"`
(`section_type: "tags"`, 10 links). The first "Customer Support" link is `"Help Center"`.

Mapping from the existing repo content (verbatim, no invented copy):

- `bannerLayoutData` → the three `home_banner_layout` banners: `image` → `image_url`,
  `btn` → `cta_text`, `btn`'s target → `cta_path = /category/<root>`.
- `promoCarouselSlides` → the three `home_promo_carousel` banners: `images[]` → `gallery`,
  `tag` → `badge`, `highlight` → `highlight`, `desc` → `description`, `btn` → `cta_text`.
- `promoBannersData` → the three `promo_strip` banners: `subtitle` → `subtitle`,
  `bg` → `bg_color`, `accent` → `accent`, `emoji` → `emoji`, `code` → `code`,
  `btn` → `cta_text`.
- `Footer.jsx` `COLS` and `SEARCH_TAGS` → sections and links. A search tag's href is
  `/search?q=<tag-slug>`.

Fixed literal UUIDs are used for the rows this script owns — for example
`b1000000-0000-4000-8000-000000000001` for a banner and
`f1000000-0000-4000-8000-000000000001` for a footer section, incrementing the last group
per row — so a re-run targets the same rows and a reviewer can recognise a seeded row.
Category seeds use the menu item ids instead (§7.1), which is why they never create a
second tree.

### 7.3 Products across the whole taxonomy (`server/seed_dynamic_products.js`, `npm run seed:products`)

Rewrite, non-destructive:

- **Remove the current `delete().neq("id", "00000000-…")`.** It wipes the live catalog.
- Upsert by deterministic id (`p1000000-0000-4000-8000-0000000000NN`); a re-run updates
  instead of duplicating.
- Read the real tree from `public.categories` at run time and generate **at least 3 products
  for every level-1 category and at least 1 for every level-2 category**, so no category
  page is empty and the seed always matches the taxonomy.
- Set `category` (display label) = category `name` and `category_id` = category `id`.
- Images: the category's `image_url` with a distinct `&sig=<n>` crop seed per product; if the
  category has no image, fall back to
  `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop&sig=<n>`.
- Cloudinary upload only when `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_API_KEY` are both set;
  otherwise store the Unsplash URL and `access_type = "public"`. Never write a fabricated
  `cloudinary_public_id`.
- Never insert orders.

Ambiguity rule for a display label (`resolveProductCategory`): return **exactly one** id —
lowest `level`, then lowest `display_order`, then `id` — and `null` when nothing matches. It
must hold for every name that occurs more than once in the seeded tree: `Accessories` (×3),
and `Ethnic Wear`, `Baby Clothes`, `Watches`, `Sunglasses` and `Jewelry` (×2 each). `Audio`
is a single level-2 node and is not an ambiguity case.

### 7.4 Verification

After applying migrations and running both seeds:

| Query                                                                                                                                   | Expected                       |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `SELECT level, count(*) FROM categories GROUP BY level ORDER BY level;`                                                                 | three rows: 7 / ~30 / ~140     |
| `SELECT count(*) FROM menu_items WHERE (id::text LIKE 'd1c%' OR id::text LIKE 'd2c%' OR id::text LIKE 'd3c%') AND category_id IS NULL;` | 0 (taxonomy rows only)         |
| `SELECT count(*) FROM menu_items WHERE level BETWEEN 1 AND 3 AND category_id IS NULL;`                                                  | 6 — the legacy navigation rows |
| `SELECT count(*) FROM categories WHERE name IN ('Mobiles','Laptops','Headphones','Watches','Bags','Cameras','Gaming');`                 | 7                              |
| `SELECT count(*) FROM products WHERE category_id IS NOT NULL;`                                                                          | ≥ 5                            |
| `SELECT count(*) FROM promo_banners;`                                                                                                   | 9                              |
| `SELECT count(*) FROM footer_sections;`                                                                                                 | 5                              |
| `SELECT count(*) FROM footer_links;`                                                                                                    | 34                             |
| `SELECT count(*) FROM products;`                                                                                                        | ≥ 3 × 7 + 30 = 51              |

The `category_id IS NULL` result is 0 **for taxonomy rows only**. The six legacy flat
`menu_items` rows are navigation-only and are expected to keep `category_id IS NULL`; a
total of 6 under that weaker query is correct, and a taxonomy-row count above 0 means the
link-back update missed a row.

Run both seeds a second time: every count must be identical. A count that grows means the
upsert key is wrong.

## 8. Security Scope

### 8.1 In scope

1. **Scoped RLS on every new table.** Two policies per table: public `SELECT` on
   `is_active = true`, and `FOR ALL TO service_role USING (true)`. No unscoped
   `FOR ALL USING (true)` anywhere. `password_reset_tokens` has no public policy at all.
2. **`POST /api/upload` guarded** with `verifyToken` and
   `requireRole(["admin","super_admin","vendor"])`. The 10 MB limit and the `image/` prefix
   check stay.
3. **`JWT_SECRET` mandatory outside development.** `assertJwtSecret()` throws when the value
   is missing or shorter than 32 characters; it is called at startup after `dotenv.config()`.
   A development-only fallback is allowed when `NODE_ENV !== "production"` and logs one loud
   warning. The variable name is the only thing documented; no value appears in the repo.
4. **Bearer scheme required.** `Authorization` must start with `Bearer `; anything else gets
   `401 { error: "Invalid authorization header." }`.
5. **Password reset is tokenised.** `POST /api/auth/request-reset` takes `{ email }` and
   always answers `{ message: "If this email is registered, a reset link has been sent." }`
   — never a `userId`, never a different message for an unknown email. It creates a
   `password_reset_tokens` row with `expires_at = now() + 30 minutes`.
   `POST /api/auth/reset-password` takes `{ token, newPassword }`, rejects unknown, expired
   (`expires_at < now()`) or already-used (`used_at` set) tokens with
   `400 { error: "Invalid or expired reset token." }`, keeps the 6-character minimum, sets
   `used_at`, updates the password, and invalidates every other token for that user.
6. **CORS allowlist.** `ALLOWED_ORIGINS` (comma-separated). When unset, allow only
   `http://localhost:5173` and `http://127.0.0.1:5173`.
7. **Terminal JSON error handler** at the end of `server/app.js`: if headers are sent,
   delegate; otherwise log and return `{ error }` with `err.status || 500`.
8. **Authorization tests for every write route.** One parameterised test asserts `401`
   without a token, `403` with a `user` token, and that no mocked write method was called,
   for: `POST/PATCH/DELETE /api/categories`, all hero writes including reorder, all banner
   writes including reorder, footer section and footer link writes including both reorders,
   `POST/PATCH/DELETE /api/menu` including reorder, and `POST /api/upload`.
9. **No secret ever reaches the client.** The service key is only read by `server/db.js`;
   the client talks to `/api` and holds only the user's JWT in
   `localStorage["marvel_jwt_token"]`.

### 8.2 Deferred, and why

These are real findings that were deliberately scoped out. They are not made worse by this
feature, and they are listed in §11 so they are not lost:

| Deferred item                                                                                                                   | Why deferred                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Unauthenticated `POST/PUT/PATCH/DELETE /api/products`                                                                           | Touches the vendor flows and the product UI; needs its own authorization design and tests.                              |
| Unauthenticated `GET/POST/PATCH /api/orders`, and `role`/`userId` read from the query string                                    | Order auth is a billing-slice decision (who may read another user's orders).                                            |
| Unauthenticated `GET /api/users` returning every profile                                                                        | Needs a role-based profile contract, not a one-line guard.                                                              |
| Unscoped `FOR ALL USING (true)` RLS on `products` and `orders`                                                                  | Fixing it requires deciding the vendor's direct-Supabase access model; doing it blind could break the vendor dashboard. |
| Privilege escalation via `profiles.role` (client-settable `user_metadata.role` plus the unrestricted own-profile UPDATE policy) | Needs an auth-trigger/policy redesign and a data audit of existing roles.                                               |

The new tables are deliberately **not** affected by any of the above: they are
service-role-only for writes, and the public read policy is scoped to active rows.

### 8.3 Environment variables

Documented by **name** only: `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY` (if the client uses it), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `ALLOWED_ORIGINS`, `NODE_ENV`. Never print, commit or paste a
value. `.env.example` gains `ALLOWED_ORIGINS=http://localhost:5173` and a comment that
`JWT_SECRET` must be at least 32 characters.

## 9. Migration & Rollback

### 9.1 Migration files, in order

| #   | File                                                           | Contents                                                                                                                                                                                                                             | Re-runnable                                        |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | `supabase/migrations/20261020000006_password_reset_tokens.sql` | `password_reset_tokens` table, RLS enabled, one service-role policy                                                                                                                                                                  | yes (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`)     |
| 2   | `supabase/migrations/20261020000007_content_taxonomy.sql`      | `categories`; `products.category_id` + index; `menu_items.category_id`; `promo_banners`; `footer_sections`; `footer_links`; all indexes; scoped RLS on the four new tables plus `hero_slides`; `set_updated_at()`; the five triggers | yes (`IF NOT EXISTS`, `DROP … IF EXISTS`)          |
| 3   | `supabase/migrations/20261020000008_seed_categories.sql`       | seed `categories` from `menu_items`; link `menu_items.category_id`; restrict `show_in_homepage`; backfill `categories.image_url` from `site_categories`; backfill `products.category_id`                                             | yes (`ON CONFLICT DO NOTHING`, idempotent updates) |
| 4   | `supabase/migrations/20261020000009_drop_site_categories.sql`  | `DROP TABLE IF EXISTS public.site_categories;`                                                                                                                                                                                       | yes, but destructive — see 9.3                     |

`supabase/schema.sql` is **regenerated** from the database (`supabase db dump --file
supabase/schema.sql --schema public`) after migration 2 and again after migration 4. It is
never hand-edited. After migration 2 it must list `categories`, `promo_banners`,
`footer_sections`, `footer_links` and `password_reset_tokens`, plus the `products.category_id`
and `menu_items.category_id` columns.

### 9.2 Apply order and gates

1. Apply 000006 → verify `SELECT to_regclass('public.password_reset_tokens');` is non-null.
2. Apply 000007 → verify the RLS policies:

```sql
SELECT tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('categories','promo_banners','footer_sections','footer_links','hero_slides');
```

Expected: for every row with `cmd = 'ALL'`, `roles` is exactly `{service_role}`. A `{public}`
or `{anon,authenticated}` role on a `FOR ALL` policy is the defect this gate exists to catch.
`FOR SELECT` rows are expected to be public: the four new tables' `Public read active …`
policies and the pre-existing `Public read active hero slides` policy (`FOR SELECT`,
`roles = {public}`, from `20261016000006:72-74`) are correct and are not defects.

3. Apply 000008 → verify the §7.4 counts (three level groups, 7 / ~30 / ~140), verify the
   `menu_items.category_id IS NULL` count is 0 **for the taxonomy rows only** (the six
   legacy navigation rows are expected to stay NULL, so the unscoped query returns 6), and
   verify that the 7 migrated legacy names (`Mobiles`, `Laptops`, `Headphones`, `Watches`,
   `Bags`, `Cameras`, `Gaming`) are present in `categories`.
4. Run `npm run seed:content`, `npm run seed:products`, then re-run both (idempotency gate).
5. Deploy the code that serves `/api/categories` and the content routes **with** the
   temporary `GET /api/content/categories` alias. Only then apply 000009. Dropping
   `site_categories` before the alias exists breaks the running storefront.
6. Apply 000009 → `SELECT to_regclass('public.site_categories');` is `NULL` and the 7
   migrated legacy names are still present in `categories`.
7. Regenerate `supabase/schema.sql`; run `npm run check` and `npm run test:e2e`.

### 9.3 Rollback

Order matters; roll back the API before the schema.

1. **Code:** redeploy the previous release (or `git revert` the feature commits). The old
   code reads `site_categories`, so step 2 must not run before this.
2. **Restore `site_categories`** from the pre-migration dump, or recreate it with the
   original DDL from `20261016000006_dynamic_menus_banners.sql` and reload its 10 rows from
   the same dump. Its rows are still recoverable from `categories` by name if no dump
   exists, but ids and `order_index` must come from the dump to restore the old homepage.
3. **Drop the feature tables in reverse dependency order:**

```sql
DROP TABLE IF EXISTS public.footer_links;
DROP TABLE IF EXISTS public.footer_sections;
DROP TABLE IF EXISTS public.promo_banners;
ALTER TABLE public.products DROP COLUMN IF EXISTS category_id;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS category_id;
DROP TABLE IF EXISTS public.categories;
DROP TABLE IF EXISTS public.password_reset_tokens;
-- hero_slides survives, and its trigger still depends on the function.
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.hero_slides;
DROP FUNCTION IF EXISTS public.set_updated_at();
```

The trigger drop is not optional. `hero_slides` survives step 3 and keeps
`trg_set_updated_at` (§3.8), and PostgreSQL refuses to drop a function that a trigger
depends on — without the `DROP TRIGGER` the script aborts on its last statement, leaving the
database half-rolled-back. Dropping the trigger first (or `DROP FUNCTION … CASCADE`) is
equivalent; this spec uses the explicit trigger drop.

4. Regenerate `supabase/schema.sql` from the rolled-back database.

What rollback loses: any content an admin created after the migration (banners, footer rows,
categories, hero edits) and every product's `category_id`. `products.category` text and
`hero_slides` survive. Take a database snapshot before applying the migrations; there is no
down-migration that can reconstruct admin-authored rows.

`20261020000009` is the only destructive migration. If it must be rolled back alone,
recreate `site_categories` from the dump and keep the rest — the alias route is already gone
by then, so the storefront must be on `/api/categories`.

## 10. Risks

| #   | Risk                                                                                                                                       | Impact                                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Two pre-existing tables order by `order_index`, while the route contract says `display_order`                                              | Reorder silently writes a column nobody reads                       | §3.6 reconciliation is binding: reorder bodies use `display_order`, the server writes `order_index` for `hero_slides` and `menu_items`; no new `display_order` columns.                                                                                                                                                                                                                                 |
| 2   | The trees are only synchronised at seed time: a menu leaf added later can point at no category, and a category can exist with no nav entry | Nav and taxonomy drift; a category page is reachable only by URL    | The menu editor derives `path` from the chosen `category_id`, the admin guide says create the category first, and `categories` — not `menu_items` — is authoritative for category pages.                                                                                                                                                                                                                |
| 3   | A bare slug is ambiguous (`accessories` ×3, `watches` ×2), so a last-segment lookup can pick a different category than the visitor clicked | The wrong category page opens and the wrong product set is returned | **The path is the identity.** Routes, nav mapping, category pages and product filters all use the full ancestor path and resolve exactly (`GET /api/categories/path`, `?categoryPath=`). The bare-slug route is kept but unused by the storefront. `resolveProductCategory` keeps lowest `level`, then `display_order`, then `id` for the one place where only a display label exists. Pinned by tests. |
| 4   | Dropping `site_categories` while old code still reads it                                                                                   | Blank homepage categories mid-rollout                               | Migration order in §9.2 plus the temporary alias; the drop ships only after the replacement API is live.                                                                                                                                                                                                                                                                                                |
| 5   | Partial `PATCH` implemented as a full replace                                                                                              | Silent data loss on every banner/slide edit                         | The factory filters the patch to keys present in the body; tests assert the exact `.update()` payload.                                                                                                                                                                                                                                                                                                  |
| 6   | Seed scripts run against the live project and delete rows                                                                                  | Catalog wiped                                                       | The destructive `delete().neq(...)` is removed; both seeds upsert by deterministic id; idempotency is a gate (§7.4).                                                                                                                                                                                                                                                                                    |
| 7   | One failed content fetch blanks the whole storefront                                                                                       | Homepage looks broken                                               | `ContentContext` isolates each fetch, exposes `error`, and every surface renders an explicit error/empty state.                                                                                                                                                                                                                                                                                         |
| 8   | `JWT_SECRET` becomes mandatory                                                                                                             | API fails to boot where the variable is unset                       | Deliberate fail-fast outside development; `.env.example` and the README document the requirement before deploy.                                                                                                                                                                                                                                                                                         |
| 9   | `ContentContext` is a single load, so another admin's edit is invisible until refresh                                                      | Stale storefront                                                    | `marvel_content_updated` event + `refresh()`; the admin console refreshes after every write.                                                                                                                                                                                                                                                                                                            |
| 10  | Deleting `data.js` and the nine storefront components in one step                                                                          | Missed import breaks the build                                      | The deletion task greps for every importer first and ends with `npm run check`.                                                                                                                                                                                                                                                                                                                         |
| 11  | Category slug renames break bookmarked URLs and menu paths                                                                                 | 404s on old links                                                   | The editor shows an inline warning when a slug changes; no redirect map in this slice (follow-up 11).                                                                                                                                                                                                                                                                                                   |
| 12  | Migration 7 is large (four tables, policies, triggers)                                                                                     | Partial apply leaves RLS off                                        | Re-runnable statements, policy verification query as a gate, apply to staging first.                                                                                                                                                                                                                                                                                                                    |

## 11. Out-of-Scope Follow-ups

Recorded so they are not lost. None of these is implemented by this feature.

1. Unauthenticated `POST/PUT/PATCH/DELETE /api/products`
   (`server/routes/products.js:111,169,196,223`).
2. Unauthenticated `GET/POST/PATCH /api/orders` and the IDOR where `role`/`userId` come from
   the query string (`server/routes/orders.js:17,44,83`).
3. Unauthenticated `GET /api/users` returning every profile (`server/routes/users.js:40`).
4. The unscoped `FOR ALL USING (true)` RLS policies on `products` and `orders`
   (`supabase/migrations/20260822000002_enhance_products_and_orders.sql:43-44,54-55`).
5. Privilege escalation via `profiles.role`: client-settable `user_metadata.role`
   (`20260822000004:35-37`) plus the unrestricted own-profile UPDATE policy
   (`20260822000000_init_schema.sql:89`).
6. `products.category` remains free text alongside `category_id`, so the display label can
   drift from the taxonomy after a rename.
7. `supabase/schema.sql` drift is fixed only for the new tables; the historical migrations
   stay append-only.
8. A repo-wide `npm run format` against the known legacy Prettier baseline, and adding
   `prettier --check` plus Knip to CI.
9. The nine orphaned `server/test_*.js` scripts: they assert nothing and mutate real data.
10. The fake product data in `src/components/product/dynamicProductBuilder.js` and the
    stubbed checkout in `src/components/cart/CartPage.jsx`.
11. Category slug redirects when a slug is renamed (risk 11).
