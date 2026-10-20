# Dynamic Site Content & Category Taxonomy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every structured content block on the storefront (hero slides, nav/mega-menu, homepage banner layouts, promo carousels, footer links, and a 3-level category + subcategory taxonomy) database-backed and editable from the admin panel, with real seeded data so nothing renders empty.

**Architecture:** One shared taxonomy table (`categories`, 3 levels via `parent_id`) becomes the single source of truth for categories. `menu_items` gains a `category_id` FK so nav leaves point into the taxonomy and their existing `/category/a/b/c` paths keep working. All content types live in typed tables and are served by a single generic CRUD router factory, so every type gets the same route set (list / get / upsert / partial-patch / delete / reorder) and the same admin-guarded "include inactive" list. On the client, a new `ContentContext` loads all content once and feeds every storefront surface, replacing per-component fetches, the duplicate `/api/menu` call, and the static `src/data.js` fallbacks.

**Tech Stack:** React 19, Vite 8, Express 4, Supabase (PostgREST + SQL migrations), Cloudinary, Vitest 5, Testing Library, Playwright, Oxlint, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-20-dynamic-site-content-design.md` (write it in Task 0 — see "Design Decisions" below, which is the approved spec content).

**Repo:** `C:\Users\anjai\OneDrive\Documents\marvel-ecommerce\Marvel-ecommerce`

---

## Global Constraints

- **Never run `git push`, `git push --follow-tags`, `gh pr create`, or any command that publishes to GitHub.** Local `git add` / `git commit` on the current branch is approved. Never force-push, never create a remote branch.
- Node.js >= 22.12.0, npm >= 10 (`package.json:7-9`).
- Quality gate for every task: `npm run check` (= `oxlint` → `vitest run` → `vite build`) must exit 0. Run it from the repo root.
- Test runner is Vitest with `happy-dom`; server tests boot the real Express app on port 0 and **must mock `server/db.js`** (the existing `server/routes/menuTree.test.js` does not and therefore writes to the live Supabase project — fix that file in Task 6).
- Field naming is **snake_case** in both DB columns and JSON request/response bodies. There is no camelCase transform layer.
- Error responses are always `{ "error": "<string>" }`. Success responses are `{ "message": "<string>" }` plus a resource key (`{ message, item }`).
- New list endpoints return a **wrapped object** keyed by resource name (`{ categories: [...] }`, `{ banners: [...] }`, `{ sections: [...], links: [...] }`). `GET /api/menu` keeps its existing bare-array shape for backwards compatibility.
- New RLS policies **must** scope write access: `FOR ALL TO service_role USING (true)`. Never write an unscoped `FOR ALL USING (true)` — that unscoped form is the existing bug on `products` and `orders` (`supabase/migrations/20260822000002_enhance_products_and_orders.sql:43-44,54-55`).
- Migrations are additive and re-runnable (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`). Never drop a table in the same migration that populates it.
- Do not reformat unrelated files. Do not run a whole-tree `npm run format` (the repo has a known legacy Prettier baseline).
- Do not edit `dist/`.
- Never print, commit, or copy secret values. Reference secrets by env-var **name** only.
- Oxlint's `jsx-a11y` rules are configured as `warn`, so a11y issues in new code will not fail the lint step — fix them anyway; new interactive elements need `role` + keyboard handlers + an accessible name.
- All new code is committed with a conventional-commit message. One commit per task unless the task says otherwise.

---

## Review Focus

Failure modes the spec implies that no task's happy-path test will catch. Each line below names the input/condition and the behavior a reasonable person expects. The owning task adds the pinning test.

1. **Admin hides a banner/slide/category, then wants it back.** Expected: the item stays visible in the admin list (greyed out) and can be re-activated. It must NOT vanish from the admin list. Owned by Task 7 (`includeInactive=1`).
2. **Admin edits a banner but only fills in one changed field.** Expected: the other fields keep their previous values. A full-replace write that nulls them is a data-loss bug. Owned by Task 7 (partial PATCH).
3. **A non-admin (or anonymous) visitor calls a content write endpoint.** Expected: 401/403 and zero database change. Owned by Task 18.
4. **The content API returns 500 / the network drops.** Expected: the storefront shows an explicit empty state, never a silently blank hero or a "no items" list that looks like real data. Owned by Task 10 and Task 13.
5. **An admin creates a category whose parent already has 3 levels of ancestry.** Expected: rejected with a 400 naming the depth limit, not a 4th level silently accepted. Owned by Task 1 and Task 4.
6. **A product whose category name matches several categories** (e.g. `Accessories` exists under Electronics, Fashion, and as a root). Expected: it is assigned to exactly one category deterministically, never duplicated. Owned by Task 5.

---

## File Structure

### New — server

| File                               | Responsibility                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `server/lib/validation.js`         | All body validators. Pure functions, no I/O. Partial-update aware via an options flag.                                                    |
| `server/lib/crudRouter.js`         | Express router factory. Builds the 6-route set for a table from a declarative config. No content-specific logic.                          |
| `server/routes/categories.js`      | Taxonomy router: tree listing, slug lookup, descendant resolution, CRUD via the factory.                                                  |
| `server/seed_content.js`           | Seeds `categories`, `promo_banners`, `footer_sections`, `footer_links` from the existing menu tree and `src/data.js` content. Idempotent. |
| `server/lib/validation.test.js`    | Validator unit tests.                                                                                                                     |
| `server/lib/crudRouter.test.js`    | CRUD factory unit tests.                                                                                                                  |
| `server/routes/categories.test.js` | Category API tests (db mocked).                                                                                                           |

### New — frontend

| File                                                 | Responsibility                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/api/client.js`                                  | Single fetch wrapper: base URL, token injection, JSON errors, 401 notification. Throws; never swallows. |
| `src/api/contentApi.js`                              | All content CRUD calls. Pure transport over `client.js`.                                                |
| `src/api/client.test.js`                             | Client wrapper tests.                                                                                   |
| `src/context/ContentContext.jsx`                     | Loads and caches all site content; exposes `useContent()`.                                              |
| `src/context/ContentContext.test.jsx`                | Context tests.                                                                                          |
| `src/components/category/CategoryPage.jsx`           | The category landing page. Renders a category's products.                                               |
| `src/components/category/CategoryPage.test.jsx`      | Category page tests.                                                                                    |
| `src/components/admin/ContentEditorKit.jsx`          | Shared editor primitives: `ImageField`, `OrderControls`, `ActiveToggle`, `EditorTable`.                 |
| `src/components/admin/CategoriesTreeEditor.jsx`      | 3-level category tree editor.                                                                           |
| `src/components/admin/CategoriesTreeEditor.test.jsx` | Category tree editor tests.                                                                             |
| `src/components/admin/BannersEditor.jsx`             | Banner placement editor (layout / carousel / strip).                                                    |
| `src/components/admin/BannersEditor.test.jsx`        | Banner editor tests.                                                                                    |
| `src/components/admin/FooterEditor.jsx`              | Footer sections + links editor.                                                                         |
| `src/components/admin/FooterEditor.test.jsx`         | Footer editor tests.                                                                                    |

### New — SQL

| File                                                      | Responsibility                                                                                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261020000007_content_taxonomy.sql` | `categories` table, `products.category_id`, `promo_banners`, `footer_sections`, `footer_links`, `menu_items.category_id`, `updated_at` triggers, scoped RLS, indexes. |
| `supabase/migrations/20261020000008_seed_categories.sql`  | Backfill `categories` from the existing `menu_items` tree (3 levels), link `menu_items.category_id`, backfill `products.category_id`.                                 |

### Modified

| File                                           | Change                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `server/middleware/auth.js`                    | Fail fast on missing `JWT_SECRET`; require the `Bearer ` scheme.                      |
| `server/routes/auth.js`                        | Password reset requires a single-use expiring token.                                  |
| `server/routes/upload.js`                      | Add `verifyToken` + role guard.                                                       |
| `server/routes/content.js`                     | Add hero PATCH/reorder/includeInactive; add banner + footer routers.                  |
| `server/routes/menu.js`                        | Add `PATCH /:id`, `includeInactive`, `category_id`; fix reorder to renumber siblings. |
| `server/routes/products.js`                    | Filter by `category_id` (with descendants); accept `category_id` on create/update.    |
| `server/app.js`                                | Terminal JSON error handler; CORS allowlist; mount the new routers.                   |
| `src/api/backendApi.js`                        | Shrink to re-exports; delete once all call sites migrate.                             |
| `src/context/ContentContext.jsx` (new)         | —                                                                                     |
| `src/App.jsx`                                  | `#/category/:slug` route; fix the silent bounce at `:93-95`.                          |
| `src/components/Header.jsx`                    | — (unchanged)                                                                         |
| `src/components/HeroBanner.jsx`                | Consume `useContent().hero`.                                                          |
| `src/components/CategorySlider.jsx`            | Consume `useContent().categories` filtered by `show_in_homepage`.                     |
| `src/components/BannerLayout.jsx`              | Consume `useContent().banners` (placement `home_banner_layout`).                      |
| `src/components/PromoBannerCarousel.jsx`       | Consume `useContent().banners` (placement `home_promo_carousel`).                     |
| `src/components/Footer.jsx`                    | Consume `useContent().footer`.                                                        |
| `src/components/HoverNav.jsx`                  | Consume `useContent().menu`; drop its own fetch.                                      |
| `src/components/navigation/DynamicMenu.jsx`    | Consume `useContent().menu`; drop its own fetch and the `data.js` fallback.           |
| `src/components/BrowseCategoriesMenu.jsx`      | Consume `useContent().categoryTree`; drop `data.js`.                                  |
| `src/components/MobileMenu.jsx`                | Consume `useContent().categoryTree`; drop `data.js`.                                  |
| `src/components/admin/UnifiedAdminConsole.jsx` | Wire 4 Site Content sub-tabs (categories, banners, footer, menus) in 4 places.        |
| `src/components/admin/HeroSlidesEditor.jsx`    | Refactor onto `ContentEditorKit`; use `contentApi`.                                   |
| `src/components/admin/MenuTreeEditor.jsx`      | Fix the bugs listed in Task 17; mount it.                                             |
| `server/seed_dynamic_products.js`              | Non-destructive; populate the whole taxonomy.                                         |
| `README.md`                                    | Admin content guide.                                                                  |

### Deleted

`src/data.js`, `src/components/admin/MenuListEditor.jsx`, `src/components/admin/AdminDashboard.jsx`, `src/components/admin/charts/SalesGrowthCard.jsx`, `src/components/Navbar.jsx`, `src/components/Sidebar.jsx`, `src/components/CategoryScroll.jsx`, `src/components/VerticalCategoryMenu.jsx`, `src/components/PromoBanners.jsx`, `src/components/FeatureBanners.jsx`, `src/components/SaleBanner.jsx`, `src/components/ProductSection.jsx`, `src/components/ui/MegaMenu.jsx`, `src/api/backendApi.js` (after migration).

---

## Design Decisions (approved spec content)

**Scope.** All _structured_ content blocks become admin-editable: hero slides, nav/mega-menu, homepage banner layout, promo carousel, promo strip, footer link columns + popular search tags, and the category taxonomy. Marketing micro-copy (section headings like "Trending Now", the footer value-prop bar, social labels, payment chips, product-card chrome) stays in code.

**Category model.** New `categories` table, 3 levels (category → subcategory → leaf), `parent_id` self-FK, `slug` unique **per parent**, depth capped at 3 and validated server-side. `products.category_id` FK added; the existing free-text `products.category` is **kept** as the display label so `dynamicProductBuilder.js:84-123` (which string-matches category names) keeps working. `menu_items.category_id` FK added. `site_categories` is dropped and its 10 rows are migrated into `categories`.

**URLs.** The category path is built by walking ancestors and equals the existing menu path format (`/category/electronics/mobiles/smartphones`). `categories.slug` is the last path segment. Because the paths already exist on `menu_items`, the seeded `categories` rows are generated by `INSERT ... SELECT FROM menu_items` — the two trees cannot drift.

**Content API.** One generic CRUD factory produces the same route set for every content type. Writes are **partial** (PATCH never nulls an omitted field). Every list supports `?includeInactive=1`, guarded by the admin role check. Every write returns the persisted row so the client learns generated UUIDs.

**Client.** `src/api/client.js` throws on non-2xx and exposes a 401 subscription; `src/api/contentApi.js` is a thin transport layer; `ContentContext` loads everything once and exposes `useContent()`.

**Security scope.** `POST /api/upload` gets a role guard. `JWT_SECRET` becomes mandatory outside development. Password reset requires a single-use expiring token. New tables get properly scoped RLS. The unauthenticated `products`/`orders` write routes and the unauthenticated `GET /api/users` are **explicitly out of scope** and listed as follow-ups.

**Data.** Every new table is seeded from content that already exists in the repo (the `menu_items` tree, `src/data.js` banner content, `Footer.jsx` link columns) so the site is fully populated the moment the migration lands. Products are re-seeded non-destructively across the entire taxonomy so no category page is empty.

---

## Task 0: Write the design spec document

**Files:**

- Create: `docs/superpowers/specs/2026-10-20-dynamic-site-content-design.md`

**Interfaces:**

- Consumes: the "Design Decisions" section above.
- Produces: the spec file that the plan header references.

- [ ] **Step 1: Write the spec file** with sections: Goals / Non-Goals, Scope, Data Model (exact DDL for every new table), API Contract (exact routes + bodies for every type), Client Architecture, Admin UX, Seed Data Strategy, Security Scope, Migration & Rollback, Risks, Out-of-Scope Follow-ups. Copy the "Design Decisions" section verbatim as its base and expand each bullet into the DDL / route tables named above.
- [ ] **Step 2: Verify no placeholders remain**

Run: `Select-String -Path "docs\superpowers\specs\2026-10-20-dynamic-site-content-design.md" -Pattern "TBD|TODO|FIXME|\?\?\?"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-20-dynamic-site-content-design.md
git commit -m "docs: spec for dynamic site content and category taxonomy"
```

---

## Task 1: Validation library

**Files:**

- Create: `server/lib/validation.js`
- Test: `server/lib/validation.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces (imported by Tasks 2, 6, 7, 8):
  - `isHttpsOrRelative(value: unknown): boolean`
  - `validateHeroSlide(body: object, opts?: { partial?: boolean }): string | null`
  - `validateCategory(body: object, opts?: { partial?: boolean }): string | null`
  - `validateBanner(body: object, opts?: { partial?: boolean }): string | null`
  - `validateFooterSection(body: object, opts?: { partial?: boolean }): string | null`
  - `validateFooterLink(body: object, opts?: { partial?: boolean }): string | null`
  - `validateDepth(body: { parent_id?: string|null, level?: number }, parent: object|null): string | null`
  - `slugify(name: string): string`

Each validator returns `null` when valid, otherwise a human-readable error string. The existing private validators in `server/routes/content.js:13-67` and `server/routes/menu.js:125-145` are moved here verbatim and re-exported from their old locations for compatibility until Task 7 replaces them.

- [ ] **Step 1: Write the failing test** `server/lib/validation.test.js` covering:
  - `isHttpsOrRelative`: `null`/`""` → true; `"/products"` → true; `"https://x.com/a"` → true; `"http://x.com"` → false; `"javascript:alert(1)"` → false; `42` → false.
  - `validateHeroSlide({title:"A"})` → null; `validateHeroSlide({})` → `"Hero slide title is required."`; `validateHeroSlide({title:"A", order_index:"1.5"})` → `"order_index must be an integer."`; `validateHeroSlide({title:"A", bg_image_url:"http://x"})` → `"Field 'bg_image_url' must be an https URL or a relative path."`
  - `validateHeroSlide({subtitle:"x"}, {partial:true})` → null (partial skips required fields).
  - `validateCategory({name:"A", slug:"a"})` → null; `validateCategory({name:"A", slug:"Bad Slug!"})` → `"slug must be lowercase letters, numbers and hyphens only."`; `validateCategory({name:"A", slug:"a", level:4})` → `"Category level must be an integer between 1 and 3."`
  - `validateBanner({title:"A", placement:"home_banner_layout"})` → null; `validateBanner({title:"A"})` → `"Banner placement is required."`; `validateBanner({title:"A", placement:"home_banner_layout", cta_path:"ftp://x"})` → contains `"cta_path"`.
  - `validateFooterSection({heading:"H"})` → null; `validateFooterSection({})` → `"Footer section heading is required."`
  - `validateFooterLink({label:"L", href:"/help"})` → null; `validateFooterLink({label:"L"})` → `"Footer link href is required."`
  - `validateDepth({level:1, parent_id:null}, null)` → null; `validateDepth({level:2, parent_id:null}, null)` → `"parent_id is required for categories below level 1."`; `validateDepth({level:3, parent_id:"p"}, {id:"p", level:2})` → null; `validateDepth({level:3, parent_id:"p"}, {id:"p", level:1})` → `"Parent category must be at level 2 for a level 3 category."`; `validateDepth({level:2, parent_id:"p"}, {id:"p", level:2})` → `"Parent category must be at level 1 for a level 2 category."`; `validateDepth({level:1, parent_id:"p"}, null)` → `"Level 1 categories must not have a parent_id."`
  - `slugify("Men's Fashion")` → `"men-s-fashion"`; `slugify("Home & Kitchen")` → `"home-kitchen"`; `slugify("TVs")` → `"tvs"`. The rule is "lowercase, replace every run of non-alphanumeric characters with a single `-`, trim leading and trailing `-`" — so `Men's Fashion` yields `men-s-fashion` (the apostrophe and the space are two separate runs), which matches the seeded path segment `men-s-fashion`.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/validation.test.js`
Expected: FAIL — `Cannot find module '../server/lib/validation'`.

- [ ] **Step 3: Implement `server/lib/validation.js`**

Move `isHttpsOrRelative`, `validateHeroSlide`, `validateSiteCategory` verbatim from `server/routes/content.js:13-67` and `validateHierarchy` from `server/routes/menu.js:125-145`, then add the `partial` option (when `opts.partial === true`, skip required-field checks and only validate the fields actually present), `validateCategory` (name + slug + optional `level`/`parent_id`/`icon`/`image_url`/`banner_image_url`/`description`), `validateBanner` (title + placement required; placement must be one of `home_banner_layout`, `home_promo_carousel`, `promo_strip`; `cta_path`/`image_url`/`bg_image_url` must be https-or-relative; `starts_at`/`ends_at` must be ISO-8601 strings when present; `ends_at` must be after `starts_at`), `validateFooterSection`, `validateFooterLink`, `validateDepth` (levels 1–3, parent level must be exactly `level - 1`), and `slugify` (lowercase, then replace every run of non-alphanumeric characters with a single `-`, then trim leading and trailing `-`; so `Men's Fashion` → `men-s-fashion`, because the apostrophe and the space are two separate runs).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/validation.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/validation.js server/lib/validation.test.js
git commit -m "feat(server): shared partial-aware body validators"
```

---

## Task 2: CRUD router factory

**Files:**

- Create: `server/lib/crudRouter.js`
- Test: `server/lib/crudRouter.test.js`

**Interfaces:**

- Consumes: `server/lib/validation.js` validators (Task 1).
- Produces:

  ```js
  createCrudRouter(config: {
    table: string,              // Supabase table name
    fields: string[],           // writable column names
    orderColumn: string,        // e.g. "display_order"
    validate: (body: object, ctx: { partial: boolean }) => string | null,
    toPayload: (body: object) => Record<string, unknown>,
    readGuard?: RequestHandler[],   // default: []
    writeGuard?: RequestHandler[],  // default: [verifyToken, requireRole(["admin","super_admin"])]
    includeInactiveParam?: string, // default "includeInactive"
    resourceKey: string,        // e.g. "category" — the key used for single-item responses
    listKey?: string,           // default: resourceKey — the key used for list responses
  }): import("express").Router
  ```

  The returned router registers, **in this order**: `GET "/"`, `GET "/reorder"` is _not_ registered here (reorder is per-type), `GET "/:id"`, `POST "/"`, `PATCH "/:id"`, `DELETE "/:id"`.

  Route behaviour:
  - `GET "/"` → `200 { [listKey]: rows[] }` (default `listKey` = `resourceKey`). Filters `is_active = true` unless `?includeInactive=1` **and** the caller passed the write guard role check. Ordering by `orderColumn` ascending, then `created_at` ascending. **A database error on a list read is a `500 { error }`, not an empty list** — degrading a failure to `[]` would make an outage look like "no content" to both the storefront and the admin editor.
  - `GET "/:id"` → `200 { [resourceKey]: row }`, or `404 { error: "..." }`.
  - `POST "/"` → validates the whole body; on error `400 { error }`; else upserts with `.select()`; `201 { message, [resourceKey]: row }`.
  - `PATCH "/:id"` → validates with `{ partial: true }`; `404` if the row does not exist; else `.update(patch).eq("id", id).select()`; `200 { message, [resourceKey]: row }`.
  - **The write set is the payload builder's output.** The factory writes exactly the keys `config.toPayload(body)` returns, filtered to `config.fields`, with `undefined` values dropped. The factory supplies a **default** `toPayload` (when a config omits it) that returns only the **body-present** keys, so the "a PATCH never nulls an omitted field" guarantee holds for any content type that does not override it. A content type that must derive a column (categories deriving `level` from `parent_id`) or rename one supplies its own `toPayload`; the derived/renamed key is then written even though the client did not send it. A client-sent key must never be silently dropped.
  - `DELETE "/:id"` → `404` if absent; else delete; `200 { message }`.

  The module also exports:

  ```js
  applyReorder(existingIds: string[], orders: { id: string; display_order?: number }[]):
    { error: string } | { renumbered: { id: string; display_order: number }[] }
  ```

  It returns `{ error: "Reorder must include every item in the scope." }` unless the id set in `orders` is **exactly** the id set in `existingIds` — a missing id, an id outside the scope, a repeated id, or an entry with no `id` are all rejected. Otherwise it returns the ids in the given order renumbered to `0..n-1`.

- [ ] **Step 1: Write the failing test** `server/lib/crudRouter.test.js`. Mock `../db.js` with a chainable supabase double (pattern already used in `server/routes/content.test.js:1-30`). Cover:
  - `POST` with an invalid body returns `400` and the validator's message, and the DB is never called.
  - `POST` returns `201` and the persisted row in the response body (so the client can read the generated UUID).
  - `PATCH` with `{title:"New"}` writes **only** `title` — assert the mocked `.update()` received exactly `{title:"New"}`.
  - `PATCH` on a missing id returns `404` and does not call `.update()`.
  - `GET "/"` without `includeInactive` adds `.eq("is_active", true)`; with `includeInactive=1` it does not.
  - `DELETE` on a missing id returns `404`.
  - The response key matches `resourceKey` for single-item responses and `listKey` for list responses.
  - `applyReorder(rows, orders)` (exported from the same module) renumbers a complete ordered id list to `display_order` `0..n-1` and returns `{ error: "Reorder must include every item in the scope." }` when the list is partial.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/crudRouter.test.js`
Expected: FAIL — `Cannot find module '../server/lib/crudRouter'`.

- [ ] **Step 3: Implement `server/lib/crudRouter.js`**

`import { Router } from "express";` and `import { verifyToken, requireRole } from "../middleware/auth.js";`. Build the router with the five handlers described above. Use `supabase.from(config.table)` for every call.

`config.toPayload` is **optional**: when a config omits it, the factory uses a default that returns only the **body-present** keys intersected with `config.fields` — so "a PATCH never nulls an omitted field" holds for every content type that does not override it. For `POST`, build the row the same way; when `body.id` is absent omit `id` so Supabase generates the default UUID, and when present include it so the upsert updates. For `PATCH`, the write set is `config.toPayload(body)` filtered to `config.fields`, with `undefined` values dropped — **not** intersected with the body's key set, so a `toPayload` that renames a body key or derives a field the client did not send still has that column written. A client-sent key must never be silently dropped.

For the `includeInactive` branch, apply the admin role check and bail out when it responds — checking `res.headersSent || res.writableEnded` so the guard's promise settles rather than staying pending.

A database error on a list read is a `500 { error }`, never an empty list.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/crudRouter.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/lib/crudRouter.js server/lib/crudRouter.test.js
git commit -m "feat(server): generic CRUD router factory for content tables"
```

---

## Task 3: Auth hardening on the content path

**Files:**

- Modify: `server/middleware/auth.js:6`, `server/middleware/auth.js:19`
- Modify: `server/routes/upload.js:22`
- Modify: `server/routes/auth.js:151-223`
- Modify: `server/app.js:18`, `server/app.js` (end of file)
- Modify: `.env.example`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `server/middleware/auth.js` exports `verifyToken`, `requireRole`, `signUserToken` (unchanged signatures) and additionally `assertJwtSecret(): void`. `server/routes/auth.js` gains `POST /api/auth/reset-password` requiring `{ token, newPassword }` and `POST /api/auth/request-reset` returning `{ message }` only (never a `userId`).

- [ ] **Step 1: Write the failing test** in a new file `server/middleware/auth.test.js`:
  - `signUserToken` + `verifyToken` with a valid `Bearer <token>` → `req.user` is set.
  - `verifyToken` with a raw token (no `Bearer ` prefix) → `401`.
  - `verifyToken` with no header → `401` with `{ error }`.
  - `requireRole(["admin"])` with `req.user.role === "user"` → `403`.
  - `assertJwtSecret()` throws when `process.env.JWT_SECRET` is empty.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/middleware/auth.test.js`
Expected: FAIL — `assertJwtSecret` is not exported / the raw token is accepted.

- [ ] **Step 3: Implement the middleware changes**
  - `server/middleware/auth.js:6` — replace the hardcoded fallback. Keep a development fallback **only** when `process.env.NODE_ENV !== "production"`, and in that case `console.warn` loudly once. Export `assertJwtSecret()` that throws `new Error("JWT_SECRET is required")` when the value is missing or shorter than 32 characters. Call it at the top of `server/app.js` (Task 3 Step 4).
  - `server/middleware/auth.js:19` — require the `Authorization` header to start with `Bearer `; strip it and reject anything else with `401 { error: "Invalid authorization header." }`.
  - `server/routes/upload.js:22` — add `verifyToken, requireRole(["admin","super_admin","vendor"])` to the route. Keep the existing 10 MB limit and the `image/` prefix check.
  - `server/routes/auth.js:151-180` — replace `forgot-password` with `request-reset`: create a `password_reset_tokens` row (see Step 4) and return **only** `{ message: "If this email is registered, a reset link has been sent." }` — never a `userId`, never a different message for unknown emails. The response carries an extra `resetToken` field **only when `process.env.EXPOSE_RESET_TOKEN === "true"` AND `NODE_ENV !== "production"`** (an explicit opt-in for local development, with a production guard so it can never be armed in a deployed environment by accident; because this codebase has no mailer). Without the opt-in the response is exactly the generic message and nothing else, and the token is written to the server log **only** outside production. The production log line records the request but must not contain the plaintext email — log the domain part only. A production mailer is an explicit follow-up — until one exists the reset flow is unavailable in production rather than exploitable.
  - `server/routes/auth.js:183-223` — `reset-password` now takes `{ token, newPassword }`. Look up the token, reject if unknown, expired (`expires_at < now()`), or already used (`used_at` set). On success set `used_at`, update the password, and invalidate every other token for that user. A missing/invalid token returns `400 { error: "Invalid or expired reset token." }`. The minimum length of 6 characters is kept.
  - **The client must follow.** `src/api/backendApi.js:251-273` currently calls the removed `POST /api/auth/forgot-password` and sends `{ email, newPassword }` to `reset-password`; `src/components/auth/LoginPage.jsx:87,100` drives a 3-step wizard from those two calls. Replace them with `apiRequestPasswordReset(email)` → `POST /api/auth/request-reset` and `apiResetPassword(token, newPassword)` → `POST /api/auth/reset-password`, and rework the wizard's step 2 to collect a **reset token** and a new password. The wizard must not be left pointing at a removed endpoint.
- [ ] **Step 4: Add the schema for reset tokens and the app-level guards**
  - New file `supabase/migrations/20261020000006_password_reset_tokens.sql`:
    ```sql
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
    ```
  - `server/app.js` — call `assertJwtSecret()` after `dotenv.config()`. Add `express.urlencoded({ extended: false })` after `express.json()`. Replace `cors({ origin: "*" })` with an allowlist built from `process.env.ALLOWED_ORIGINS` (comma-separated); when the variable is unset, allow only `http://localhost:5173` and `http://127.0.0.1:5173`. Append a terminal error handler at the end of the file:
    ```js
    app.use((err, req, res, next) => {
      if (res.headersSent) return next(err);
      console.error("[api] unhandled error:", err);
      res.status(err.status || 500).json({ error: err.message || "Internal server error." });
    });
    ```
  - `.env.example` — add `ALLOWED_ORIGINS=http://localhost:5173` and `EXPOSE_RESET_TOKEN=false` (a deliberate opt-in that makes the reset token visible in the `request-reset` response so the local flow is completable), and a comment that `JWT_SECRET` must be at least 32 characters.
- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run server/middleware/auth.test.js server/routes/auth.test.js`
Expected: PASS (create `server/routes/auth.test.js` if absent — it must mock `../db.js` and assert that `request-reset` returns the same body for a known and an unknown email).

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add server/middleware/auth.js server/middleware/auth.test.js server/routes/auth.js server/routes/auth.test.js server/routes/upload.js server/app.js .env.example supabase/migrations/20261020000006_password_reset_tokens.sql
git commit -m "fix(security): JWT secret required, bearer-only tokens, password reset tokens, upload auth"
```

---

## Task 4: Taxonomy and content schema

**Files:**

- Create: `supabase/migrations/20261020000007_content_taxonomy.sql`
- Create: `supabase/migrations/20261020000008_seed_categories.sql`
- Modify: `supabase/schema.sql` (regenerate — see Step 5)

**Interfaces:**

- Consumes: nothing.
- Produces (the exact schema every later task codes against):

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

  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products (category_id);

  ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

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

  RLS, for **each** new table, in the scoped form (never an unscoped `FOR ALL USING (true)`):

  ```sql
  ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read active <t>" ON public.<t>;
  CREATE POLICY "Public read active <t>" ON public.<t> FOR SELECT TO anon, authenticated USING (is_active = true);
  DROP POLICY IF EXISTS "Service role full access on <t>" ON public.<t>;
  CREATE POLICY "Service role full access on <t>" ON public.<t> FOR ALL TO service_role USING (true);
  ```

  (`footer_links` has no `is_active`-only public read problem: give it the same two policies, using `is_active = true`.)

  `updated_at` trigger, applied to `categories`, `promo_banners`, `footer_sections`, `footer_links`, and `hero_slides`:

  ```sql
  CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = timezone('utc', now()); RETURN NEW; END $$;
  DROP TRIGGER IF EXISTS trg_set_updated_at ON public.<t>;
  CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.<t> FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  ```

  Seed migration `20261020000008_seed_categories.sql` — the `categories` tree is generated from `menu_items` so the two can never drift:

  The seed runs as **three separate inserts, one per level** (level 1, then 2, then 3), because a single `INSERT … SELECT` gives no row-ordering guarantee and the self-referencing `parent_id` FK is immediate, not deferred. Each insert selects only the mega-menu rows — the ones with the fixed `d1c…` / `d2c…` / `d3c…` ids — and computes the slug by taking the **last** path segment:

  ```sql
  -- level 1
  INSERT INTO public.categories (id, name, slug, parent_id, level, display_order, is_active, show_in_nav, show_in_homepage)
  SELECT m.id, m.title,
         lower(regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')),
         m.parent_id, m.level, COALESCE(m.order_index, 0), COALESCE(m.is_active, true), true, (m.level = 1)
  FROM public.menu_items m
  WHERE m.level = 1 AND m.id::text LIKE 'd1c%'
  ON CONFLICT DO NOTHING;

  -- level 2  (same shape, WHERE m.level = 2 AND m.id::text LIKE 'd2c%')
  -- level 3  (same shape, WHERE m.level = 3 AND m.id::text LIKE 'd3c%')
  ```

  **`split_part` must not be used.** `split_part(x, '/', n)` returns the _n_-th field, so it is the empty string for any path with fewer than _n_ segments — `split_part(m.path, '/', 4)` yields `''` for levels 1 and 2, and `split_part(stripped, '/', 3)` yields `''` for levels 1 and 2 as well. The `^.*/` form strips everything up to and including the last slash, so it is correct for one, two and three segments alike:

  - `/category/electronics` → `electronics`
  - `/category/electronics/mobiles` → `mobiles`
  - `/category/electronics/mobiles/smartphones` → `smartphones`

  `COALESCE` is required because `menu_items.order_index` and `menu_items.is_active` are nullable while the `categories` columns are `NOT NULL`.

  Then link them back and set the homepage strip:

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
  ```

  This `UPDATE` is what actually decides the homepage strip — it runs **after** the three inserts and overrides the `(m.level = 1)` value they set. The seven titles are the verified seeded level-1 roots; if a future mega-menu seed renames a root, this statement must change with it, and the §7.4 level-group gate will show the change immediately.

  The 6 legacy flat rows are navigation-only: they keep `category_id IS NULL` and are never part of the taxonomy.
  - `show_in_homepage` is owned by the `UPDATE public.categories SET show_in_homepage = (level = 1 AND name IN (...))` statement that runs after the three inserts — the `(m.level = 1)` value the inserts write is overridden by it. The 7 names are the verified seeded level-1 titles (`Electronics`, `Fashion`, `Home & Kitchen`, `Beauty`, `Sports`, `Toys & Baby`, `Accessories`) — note the seeded root is `Sports`, not "Sports & Fitness". If a future mega-menu seed renames a root, the statement must change with it, and the §7.4 level-group gate will show the change immediately.
  - `image_url` is backfilled from `public.site_categories.image_url` by matching `lower(site_categories.name) = lower(categories.name)`; unmatched rows keep `image_url` NULL and fall back to a per-root image.
  - `products.category_id` backfill, with a deterministic three-key tiebreak (level, then `display_order`, then `id`) so a name that appears twice at the same minimum level — `Ethnic Wear` exists at level 3 under both Men's and Women's Fashion — binds to exactly one row:
    ```sql
    UPDATE public.products p SET category_id = c.id
    FROM public.categories c
    WHERE lower(c.name) = lower(p.category)
      AND c.id = (
        SELECT c2.id FROM public.categories c2
        WHERE lower(c2.name) = lower(p.category)
        ORDER BY c2.level ASC, c2.display_order ASC, c2.id ASC
        LIMIT 1
      );
    ```
    Rows that match nothing are left with `category_id IS NULL` and keep their `category` text; the seed script in Task 5 rewrites them onto real categories.
  - The `categories` seed selects **only the mega-menu rows** with the fixed-UUID prefix predicate, because `menu_items` also contains 6 legacy flat rows seeded by `supabase/migrations/20260822000000_init_schema.sql:143-151` (`Home & Shop` `/`, `Electronics & Tech` `/category/electronics`, `Fashion & Lifestyle` `/category/fashion`, `Vendor Portal`, `Admin Panel`, `Super Admin System`). Migration `20261016000006:13` adds `level INT DEFAULT 1`, so all 6 are level 1 with `parent_id IS NULL` and no migration deletes them. Selecting them would collide `Electronics & Tech` → slug `electronics` with the real root, produce an empty slug for `Home & Shop` (path `/`), and turn the three dashboard rows into categories. The mega-menu rows are the ones migration `20261016000006` seeded with fixed ids: `d1c…` (level 1), `d2c…` (level 2), `d3c…` (level 3) — e.g. `d1c00000-0000-4000-8000-000000000001`. So:
    ```sql
    WHERE m.id::text LIKE 'd1c%' OR m.id::text LIKE 'd2c%' OR m.id::text LIKE 'd3c%'
    ```
    The 6 legacy rows are **navigation-only**: they keep `category_id IS NULL` and are not part of the taxonomy.
  - The seed runs as **three separate inserts, one per level** (level 1, then 2, then 3), because a single `INSERT … SELECT` gives no row-ordering guarantee and the self-referencing `parent_id` FK is immediate, not deferred.
  - The seed's **hard guard** follows the three inserts — it does not have to be the last statement in the file, because the backfills that follow it do not touch the columns it checks. It aborts the migration rather than applying a corrupted tree. Compare the inserted counts against the **live per-prefix counts in `menu_items`** — not hard-coded numbers — so the guard stays correct when the mega-menu seed grows:
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
    The empty-slug check is what catches a stray legacy row (for example `Home & Shop`, whose path `/` yields an empty slug) even if it somehow matched the prefix predicate.
  - `site_categories` is **not** dropped in this migration. The storefront still calls `GET /api/content/categories` until Task 13, and the new `/api/categories` route does not exist until Task 6 — dropping the table here would break the running app mid-plan. The table is dropped in Task 6, after the replacement API is in place, and Task 6 keeps a temporary alias route so the storefront keeps working until Task 13. The drop ships as a **second** paste bundle (`docs/sql/apply-02-drop-site-categories.sql`) that the human applies only after Task 6's code is deployed.

    > **As shipped:** the temporary alias was removed in the final review fix wave, once the storefront was fully migrated and the old flat category editor was deleted. Nothing calls the dropped table any more, so `apply-02` is safe as soon as this branch is deployed. See Ruling R21 in the ledger.

- [ ] **Step 1: Produce the paste-ready SQL bundle and verify its shape statically**

This environment has no Docker, the Supabase project is not linked to the CLI, and `.env` carries no access token or DB password — **the DDL cannot be applied from here.** The human partner applies it (this was their explicit decision).

Create `docs/sql/apply-01-content-taxonomy.sql` containing, in order and fully concatenated (no psql meta-commands, no `\i` includes — a single script the human can paste into the Supabase SQL Editor as-is):

1. The full contents of `supabase/migrations/20261020000007_content_taxonomy.sql`.
2. The full contents of `supabase/migrations/20261020000008_seed_categories.sql`.
3. A trailing comment block listing the verification queries the human should run afterwards (Step 5 below), each prefixed with `--` so the script stays valid SQL.

The two migration files in `supabase/migrations/` remain the source of truth for a future `supabase db push`; the bundle in `docs/sql/` is the human-facing artifact and must contain the same statements in the same order.

Verify statically that the script is valid SQL by eye: every statement is terminated, every `CREATE TABLE` is followed by its `CREATE INDEX` and both RLS policies, and the `set_updated_at` trigger is created before it is attached to a table.

- [ ] **Step 2: Verify the RLS policies are scoped, not unscoped**

Read the policy statements you just wrote and confirm every `FOR ALL` policy names `TO service_role`. If any says `TO public` or omits the role, fix it before continuing. The unscoped `FOR ALL USING (true)` form is the existing bug on `products` and `orders` (`supabase/migrations/20260822000002_enhance_products_and_orders.sql:43-44,54-55`) and must not be repeated.

- [ ] **Step 3: Verify the `categories` seed inserts in level order**

The `categories` seed must be **three separate `INSERT` statements, one per level** (level 1, then 2, then 3) — a single `INSERT … SELECT` inserting self-referencing rows gives no ordering guarantee and can violate the `parent_id` foreign key, because the FK is immediate rather than deferred. Confirm the bundle contains three inserts, in that order.

- [ ] **Step 4: Verify the slug expression derives the right slug at each level**

The slug expression must take the **last** path segment. The correct Postgres expression is:

```sql
regexp_replace(regexp_replace(m.path, '^.*/', ''), '[^a-zA-Z0-9-]+', '-', 'g')
```

Trace all three levels by hand and confirm the three insert statements in the bundle match:

- `/category/electronics` → `electronics`
- `/category/electronics/mobiles` → `mobiles`
- `/category/electronics/mobiles/smartphones` → `smartphones`

**Do not use `split_part`.** `split_part(x, '/', 3)` returns the third field, which is the empty string for a one-segment path and the empty string for a two-segment path — so it yields `''` for every level-1 and level-2 row. (`split_part(m.path, '/', 4)` has the same defect, and worse: it returns `''` for level 2.) The `^.*/` form strips everything up to and including the last slash, so it is correct for one, two and three segments alike.

- [ ] **Step 5: Write the verification checklist for the human partner**

Append to `docs/sql/apply-01-content-taxonomy.sql` (as SQL comments) the queries the human should run after pasting, each with its expected result:

```sql
-- Expected: three groups, 7 / 31 / 149
SELECT level, count(*) FROM public.categories GROUP BY level ORDER BY level;
-- Expected: 0 for taxonomy rows (the 6 legacy flat menu_items rows keep category_id IS NULL by design)
SELECT count(*) FROM public.menu_items
WHERE (id::text LIKE 'd1c%' OR id::text LIKE 'd2c%' OR id::text LIKE 'd3c%')
  AND category_id IS NULL;
-- Expected: 6 (the legacy flat rows: Home & Shop, Electronics & Tech, Fashion & Lifestyle, Vendor Portal, Admin Panel, Super Admin System)
SELECT count(*) FROM public.menu_items WHERE category_id IS NULL;
-- Expected: still present — apply-01 does NOT drop it. The drop is apply-02, which the human
-- applies only after the Task 6 code is deployed.
SELECT to_regclass('public.site_categories');
-- Expected: 8 — only names that are also menu_items titles are migrated. TVs, Shoes and Perfumes
-- exist only in the old site_categories seed, so they are NOT in the taxonomy and their images
-- fall back. `Watches` is a category title TWICE (level 2 /category/accessories/watches and
-- level 3 /category/fashion/accessories/watches), so it contributes 2 rows: 6 + 2 = 8.
SELECT count(*) FROM public.categories WHERE name IN ('Mobiles','Laptops','Headphones','Watches','Bags','Cameras','Gaming');
-- Expected: every FOR ALL policy scoped to service_role
SELECT tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname='public' AND tablename IN ('categories','promo_banners','footer_sections','footer_links');
```

Copy this same checklist into the task report so the human partner has it in one place.

- [ ] **Step 6: Regenerate `supabase/schema.sql`**

`supabase db dump` requires a linked project, which is unavailable here. **Hand-append** the new tables' DDL to `supabase/schema.sql` in the same style as the existing file: the `categories`, `promo_banners`, `footer_sections`, `footer_links` tables, the `products.category_id` and `menu_items.category_id` columns, the new indexes, the scoped RLS policies, and the `set_updated_at` function and triggers. Do not rewrite the parts of the file you are not adding to. Note in the report that `schema.sql` was hand-maintained rather than dumped, and that it should be regenerated with `supabase db dump` once a linked project is available.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261020000007_content_taxonomy.sql supabase/migrations/20261020000008_seed_categories.sql supabase/schema.sql
git commit -m "feat(db): 3-level category taxonomy, banner and footer content tables"
```

---

## Task 5: Seed all content so nothing is empty

**Files:**

- Create: `server/seed_content.js`
- Modify: `server/seed_dynamic_products.js`
- Modify: `package.json` (scripts)

**Interfaces:**

- Consumes: the schema from Task 4; the existing `menu_items` tree; the banner content currently in `src/data.js`; the footer link columns currently in `src/components/Footer.jsx:46-104`.
- Produces: npm scripts `"seed:content": "node server/seed_content.js"` and `"seed:products": "node server/seed_dynamic_products.js"`. Both scripts are **idempotent** and **non-destructive** — running them twice must not duplicate or delete anything.

- [ ] **Step 1: Write the failing test** `server/seed_content.test.js`. Mock `../db.js`. Cover:
  - `buildCategorySeeds(menuRows)` maps a 3-level menu tree to 3 levels of category seeds with `slug` = last path segment, `parent_id` = the parent menu item's id, and `level` preserved.
  - `buildBannerSeeds()` returns 9 banners: 1 `home_banner_layout` with `variant:"large"`, 2 with `variant:"small"`, 3 `home_promo_carousel`, 3 `promo_strip` — with the exact titles `"Make Your Home Beautiful"`, `"Style That Speaks"`, `"Beauty for You"`, `"End of Season Sale"`, `"Electronics Mega Sale"`, `"Style Redefined"`, `"Big Savings Days"`, `"Extra 10% Off"`, `"No Cost EMI"`.
  - `buildFooterSeeds()` returns 5 sections — `"Customer Support"`, `"Policy & Legal"`, `"My Account"`, `"Popular Categories"`, `"Popular Searches"` — with 6, 6, 6, 6 and 10 links respectively, and the first link of `"Customer Support"` is `"Help Center"`.
  - `resolveProductCategory(categoryName, categories)` returns **exactly one** category id for an ambiguous name: `"Accessories"` exists as a level-1 root, under Electronics and under Fashion — it must resolve to the lowest-`level` match, and it must never return more than one id. The same rule must hold for `"Audio"` and `"Watches"`.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/seed_content.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/seed_content.js`**

Export the three pure builders (`buildCategorySeeds`, `buildBannerSeeds`, `buildFooterSeeds`) plus `resolveProductCategory(categoryName, categories)` and `seedContent()`. `resolveProductCategory` returns the **single** matching category id — the lowest `level` match, then the lowest `display_order` — and `null` when nothing matches. `seedContent()` upserts with `.upsert(rows, { onConflict: "id" })` using **deterministic UUIDs** (`gen_random_uuid()` replaced by fixed literals derived from a stable hash of the seed key, e.g. `c1000000-0000-4000-8000-000000000001`). Banner seeds map directly from `src/data.js`: `bannerLayoutData` → 3 `home_banner_layout` banners (`variant` `large`/`small`/`small`, `image` → `image_url`, `btn` → `cta_text`, `cta_path` → `/category/<root>`); `promoCarouselSlides` → 3 `home_promo_carousel` banners (`images[]` → `gallery` text[], `tag` → `badge`, `highlight` → `highlight`, `desc` → `description`, `btn` → `cta_text`); `promoBannersData` → 3 `promo_strip` banners (`subtitle` → `subtitle`, `bg` → `bg_color`, `accent` → `accent`, `emoji` → `emoji`, `code` → `code`, `btn` → `cta_text`). Footer seeds copy `COLS` and `SEARCH_TAGS` from `Footer.jsx` verbatim; the `"Popular Searches"` section has `section_type:"tags"` and its 10 tags become links with `href:"/search?q=<tag-slug>"`.

- [ ] **Step 4: Implement the non-destructive product seed**

Rewrite `server/seed_dynamic_products.js`:

- **Remove** the `delete().neq("id", "00000000-…")` call at the current line 186 — it wipes the live catalog.
- Upsert by a deterministic product id so re-running updates instead of duplicating. **The id must be a valid UUID literal** — Postgres' `uuid_in` rejects a non-hexadecimal character and PostgREST answers 400 for the whole bulk upsert — so the prefix is hex-only, e.g. `e1000000-0000-4000-8000-0000000000NN`. A `p1…` prefix is **not** valid: `p` is not a hex digit.
- Generate **at least 3 products for every level-1 category and at least 1 for every level-2 category** — read the real tree from `public.categories` at run time and build the product list from it, so the seed always matches the taxonomy.
- Set `category` (display label) to the category `name` and `category_id` to the category `id`.
- Images: use the category's `image_url` with a distinct `&sig=<n>` crop seed per product so the images differ but need only one real URL per category. If the category has no `image_url`, fall back to `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop&sig=<n>`.
- Cloudinary upload is attempted only when `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_API_KEY` are both set; otherwise the Unsplash URL is stored directly and `access_type` is left `"public"`. Never write a fake `cloudinary_public_id` (the current `server/services/cloudinary.js:70-79` fallback does exactly that — do not reuse it here).
- Do not insert orders.
- [ ] **Step 5: Verify the seeds against a mocked database and hand the run commands to the human**

The live database cannot be reached from this environment (no linked project, no DB password), so the seeds are exercised against a mocked `server/db.js` in `server/seed_content.test.js`. The test must assert that `seedContent()` issues upserts keyed on the deterministic ids, that it issues **no** delete statements, and that a second call produces the same upsert payload as the first (idempotency, proven without a real database).

Then produce a human-facing runbook at `docs/sql/apply-03-run-seeds.md` containing:

1. The prerequisites: Task 4's `apply-01-content-taxonomy.sql` must already be applied, and `.env` must contain `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. The two commands, in order: `npm run seed:content` and then `npm run seed:products`.
3. The verification queries with their expected results:

```sql
SELECT count(*) FROM public.promo_banners;      -- 9
SELECT count(*) FROM public.footer_sections;   -- 5
SELECT count(*) FROM public.footer_links;      -- 34
SELECT count(*) FROM public.products;          -- >= 3 * 7 + 31 = 52 (3 per root, 1 per level-2)
```

4. A note that `npm run seed:products` uploads images to Cloudinary when `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_API_KEY` are set, and falls back to plain Unsplash URLs when they are not.
5. An idempotency check: run both commands a second time and re-run the four `count(*)` queries — the counts must be **identical**. If they grew, the upsert keys are wrong.

Do not run the seeds yourself against any database.

- [ ] **Step 6: Run the full gate and commit**

Run: `npm run check`
Expected: exit 0.

```bash
git add server/seed_content.js server/seed_content.test.js server/seed_dynamic_products.js package.json docs/sql/apply-03-run-seeds.md
git commit -m "feat(seed): populate taxonomy, banners, footer and products"
```

---

## Task 6: Categories API

**Files:**

- Create: `server/routes/categories.js`
- Create: `server/routes/categories.test.js`
- Create: `supabase/migrations/20261020000009_drop_site_categories.sql`
- Modify: `server/app.js:34-40` (mount `/api/categories`)

**Interfaces:**

- Consumes: `createCrudRouter` (Task 2), `validateCategory` + `validateDepth` + `slugify` (Task 1).
- Produces these routes:

  | Method | Path                         | Auth   | Response                                                                                                                                                                                                                                                                                                                                     |
  | ------ | ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | GET    | `/api/categories`            | public | `{ categories: [...] }` — flat list, `is_active = true` unless `?includeInactive=1` + admin                                                                                                                                                                                                                                                  |
  | GET    | `/api/categories/tree`       | public | `{ categories: [...] }` — nested `children` arrays, each node `{ ...row, children: [...] }`, roots first, siblings ordered by `display_order`                                                                                                                                                                                                |
  | GET    | `/api/categories/slug/:slug` | public | `{ category: {...}, ancestors: [...], descendants: [...] }` — **bare-slug lookup**: resolves to the shallowest match and sets `category.ambiguous = true` when several rows share the slug. The storefront does **not** use this route — slugs are only unique per parent, so `accessories` exists 3× and `watches` 2×.                      |
  | GET    | `/api/categories/path`       | public | `{ category: {...}, ancestors: [...], descendants: [...] }` — **exact path lookup**: `?path=electronics/mobiles/smartphones`. Resolves by walking segments: the level-1 row whose slug is segment 1, then its child whose slug is segment 2, and so on. `404 { error }` when there is no exact match. This is the route the storefront uses. |
  | GET    | `/api/categories/:id`        | public | `{ category: {...} }`                                                                                                                                                                                                                                                                                                                        |
  | POST   | `/api/categories`            | admin  | `201 { message, category }`                                                                                                                                                                                                                                                                                                                  |
  | PATCH  | `/api/categories/:id`        | admin  | `200 { message, category }` — partial                                                                                                                                                                                                                                                                                                        |
  | PATCH  | `/api/categories/reorder`    | admin  | `200 { message }` — body `{ orders: [{id, display_order}] }`, renumbers one sibling group                                                                                                                                                                                                                                                    |
  | DELETE | `/api/categories/:id`        | admin  | `200 { message }` — cascades to descendants via the FK                                                                                                                                                                                                                                                                                       |

  `:slug` matching in `GET /slug/:slug` resolves **one** category, preferring the shallowest match; ambiguity is resolved by lowest `level`, then lowest `display_order`. Document this in the response as `category.ambiguous` = `true` when more than one row shares the slug. `GET /path` resolves **exactly** and never sets `ambiguous` — the path is the identity.

  **Both lookup routes must be registered before `GET /:id`**, and `GET /tree` before both, so neither `tree` nor `path` is captured as an id.

  **`/reorder` must be registered before `/:id`**, or Express captures the literal string `reorder` as an id. The admin tree editor calls it, so it is part of the editor contract, not an optional extra.

- [ ] **Step 1: Write the failing test** `server/routes/categories.test.js`. Mock `../db.js` (do **not** hit the real project). Cover:
  - `GET /api/categories` returns `{ categories: [...] }` and filters `is_active = true`.
  - `GET /api/categories/tree` nests children under their parent and orders siblings by `display_order`.
  - `GET /api/categories/slug/electronics` returns the level-1 Electronics row with `ancestors: []` and its `descendants` ids.
  - `POST /api/categories` with `{name:"X", slug:"x"}` → `201` and the persisted row in the body.
  - `POST /api/categories` with a level-3 `parent_id` whose parent is level 2 → `400` mentioning the depth/parent rule.
  - `POST /api/categories` with a `parent_id` that does not exist → `400` `"Parent category not found."`.
  - `PATCH /api/categories/:id` with `{name:"New"}` writes only `name`.
  - `DELETE /api/categories/:id` → `200 { message }`.
  - A write without a token → `401`; with a `user`-role token → `403`.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/routes/categories.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/routes/categories.js`**

Use `createCrudRouter` for the CRUD set, with `fields: ["name","slug","parent_id","level","description","icon","image_url","banner_image_url","display_order","is_active","show_in_nav","show_in_homepage"]`, `orderColumn: "display_order"`, `resourceKey: "category"`, and a `toPayload` that coerces `display_order`/`level` to integers, keeps only the body-present keys, and **derives `level` from `parent_id` when `parent_id` is present** (`parent.level + 1`, or `1` when `parent_id` is null) — so moving a category to a new parent can never leave a stale level behind. Because this route supplies its own `toPayload`, the derived `level` is written even though the client did not send it; that is the one documented exception to the "PATCH writes only the keys the client sent" rule. Wrap the CRUD router in an `express.Router()` that also defines `GET /tree` **before** `GET /:id` so `tree` is not captured as an id, `GET /path` **before** `GET /:id` so `path` is not captured as an id, and `PATCH /reorder` **before** `PATCH /:id` so `reorder` is not captured as an id. `GET /slug/:slug` queries by `slug` (all levels), picks the lowest `level` match, then loads ancestors by walking `parent_id` and descendants by selecting rows whose `parent_id` is in the descendant set (repeat to a fixed depth of 3). `GET /path?path=a/b/c` resolves **exactly** by segment walk — read `?path`, split on `/`, and for each segment find the child of the previously matched row whose `slug` equals that segment; `404 { error: "No category found for path '<path>'." }` when any segment fails to match.

- [ ] **Step 4: Mount the router and add the backwards-compatible alias**

In `server/app.js`, add `import categoriesRoutes from "./routes/categories.js";` and `app.use("/api/categories", categoriesRoutes);` inside the router block at `:34-40`, **before** the `/api/*` 404 catch-all.
Then, in `server/routes/content.js`, add a temporary alias so the running storefront keeps working until Task 13 (the storefront calls the old `GET /api/content/categories` path):

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

> **As shipped:** the alias block (and the `POST`/`DELETE` routes that came with it) was
> **removed** in the final review fix wave, once the storefront was fully migrated and the old
> flat category editor was deleted. It had become a second, divergent admin write path onto the
> same table — creating roots only, writing 5 of the 12 writable columns, and refusing to
> delete a category with children while the real route cascades — and its two write routes were
> not in the authorization sweep. See Ruling R21 in the ledger.

- [ ] **Step 5: Produce the second paste bundle that drops `site_categories`**

Create `supabase/migrations/20261020000009_drop_site_categories.sql`:

```sql
DROP TABLE IF EXISTS public.site_categories;
```

Create `docs/sql/apply-02-drop-site-categories.sql` containing that one statement plus a trailing SQL-comment block with the human's verification query (`SELECT to_regclass('public.site_categories');` → expect `NULL`) and a header comment stating **when** to apply it: only after Task 6's code is deployed, because the storefront calls the old `GET /api/content/categories` path until Task 13. The Task 6 alias route keeps that path working, so the drop is safe once this code is live.

Do not apply it yourself — the human partner applies both bundles.

- [ ] **Step 6: Fix the existing live-DB test**

`server/routes/menuTree.test.js` currently does not mock `../db.js` and therefore writes to the live Supabase project during `npm test`. Add the same `vi.mock("../db.js", …)` pattern used in `server/routes/content.test.js:1-30`. Verify by running the suite and confirming no `https://*.supabase.co` request appears in the output.

- [ ] **Step 7: Run the test to verify it passes, then the full gate**

Run: `npx vitest run server/routes/categories.test.js server/routes/menuTree.test.js` then `npm run check`.
Expected: all PASS, exit 0.

- [ ] **Step 8: Commit**

```bash
git add server/routes/categories.js server/routes/categories.test.js server/routes/menuTree.test.js server/routes/content.js server/app.js supabase/migrations/20261020000009_drop_site_categories.sql
git commit -m "feat(api): category taxonomy tree, slug lookup and CRUD"
```

---

## Task 7: Content API — hero, banners, footer

**Files:**

- Modify: `server/routes/content.js` (rewrite the file)
- Modify: `server/routes/content.test.js` (extend)
- Modify: `server/app.js` (mount `/api/content/banners` and `/api/content/footer`)

**Interfaces:**

- Consumes: `createCrudRouter` (Task 2), validators from Task 1.
- Produces:

  | Method            | Path                                   | Auth   | Response                                                                                                                                                                                                                                 |
  | ----------------- | -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | GET               | `/api/content/hero`                    | public | `{ slides: [...] }`; `?includeInactive=1` + admin returns inactive too                                                                                                                                                                   |
  | GET               | `/api/content/hero/:id`                | public | `{ slide: {...} }`                                                                                                                                                                                                                       |
  | POST              | `/api/content/hero`                    | admin  | `201 { message, slide }` — upsert by `id`                                                                                                                                                                                                |
  | PATCH             | `/api/content/hero/:id`                | admin  | `200 { message, slide }` — **partial**                                                                                                                                                                                                   |
  | DELETE            | `/api/content/hero/:id`                | admin  | `200 { message }`                                                                                                                                                                                                                        |
  | PATCH             | `/api/content/hero/reorder`            | admin  | `200 { message }` — body `{ orders: [{id, display_order}] }`                                                                                                                                                                             |
  | GET               | `/api/content/banners`                 | public | `{ banners: [...] }`; optional `?placement=` filter                                                                                                                                                                                      |
  | POST/PATCH/DELETE | `/api/content/banners[/:id]`           | admin  | as above, `{ message, banner }`                                                                                                                                                                                                          |
  | PATCH             | `/api/content/banners/reorder`         | admin  | body `{ orders: [{id, display_order}] }`                                                                                                                                                                                                 |
  | GET               | `/api/content/footer`                  | public | `{ sections: [...], links: [...] }` — `links` is the **flat** list of every link, and each entry of `sections` additionally carries its own nested `links: [...]` array. The storefront and the footer editor both read the nested form. |
  | POST/PATCH/DELETE | `/api/content/footer/sections[/:id]`   | admin  | `{ message, section }`                                                                                                                                                                                                                   |
  | POST/PATCH/DELETE | `/api/content/footer/links[/:id]`      | admin  | `{ message, link }`                                                                                                                                                                                                                      |
  | PATCH             | `/api/content/footer/sections/reorder` | admin  | body `{ orders: [{id, display_order}] }`                                                                                                                                                                                                 |
  | PATCH             | `/api/content/footer/links/reorder`    | admin  | body `{ orders: [{id, display_order}] }`, scope = one `section_id`                                                                                                                                                                       |

  Reorder semantics (identical for hero, banners, footer sections, footer links): the body must contain the **complete** ordered list of ids for the affected scope. The server renumbers `display_order` to `0..n-1` in the given order and returns `200 { message }`. A body missing ids currently present in the scope is rejected with `400 { error: "Reorder must include every item in the scope." }`.

  **Ordering-column reconciliation (binding, see spec §3.6).** The request vocabulary is always `display_order`, and the **array order is authoritative** — the server renumbers from the array positions and ignores the submitted numbers. But two pre-existing tables keep their existing `order_index` column and must **not** get a `display_order` column: `hero_slides` and `menu_items`. For those two, the renumbered values are persisted to `order_index`, because that is what `buildMenuTree`, `GET /api/menu` and `GET /api/content/hero` already sort by. So the hero CRUD router sets `orderColumn: "order_index"`, and the banner, section, link and category routers set `orderColumn: "display_order"`. List and single-item responses return the raw row, so hero and menu rows carry `order_index` while the four new tables' rows carry `display_order`.

  Register every `/reorder` route **before** the matching `/:id` route, or Express captures the literal string `reorder` as an id.

- [ ] **Step 1: Extend the failing test** `server/routes/content.test.js` with cases for:
  - `GET /api/content/hero?includeInactive=1` with an admin token does **not** filter `is_active = true`; without the token it returns `401`.
  - `PATCH /api/content/hero/:id` with `{subtitle:"New"}` writes only `subtitle` (assert the mocked `.update()` payload).
  - `PATCH /api/content/hero/:id` on a missing id → `404`.
  - `POST /api/content/hero` → `201` and the persisted row in the body (currently it returns only a message).
  - `PATCH /api/content/hero/reorder` with a complete list → renumbers to `0..n-1`; with a partial list → `400`.
  - `GET /api/content/banners?placement=home_promo_carousel` filters by placement.
  - `POST /api/content/banners` with a missing `placement` → `400` `"Banner placement is required."`.
  - `GET /api/content/footer` returns sections each carrying their own `links` array.
  - Every write route returns `401` with no token and `403` with a `user` token.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/routes/content.test.js`
Expected: FAIL — the new routes are not registered.

- [ ] **Step 3: Rewrite `server/routes/content.js`**

Keep `GET /api/content/hero` and `POST /api/content/hero` responding with the **same key names** the storefront already uses (`slides`) — configure the factory with `resourceKey: "slide", listKey: "slides"`. Add the missing routes. Move the validators to `server/lib/validation.js` (Task 1) and import them. Build the hero router with `createCrudRouter` using `resourceKey: "slide", listKey: "slides"` and `orderColumn: "order_index"` — `hero_slides` keeps its existing `order_index` column and must **not** gain a `display_order` column. For banners use `resourceKey: "banner", listKey: "banners"`, `fields: ["placement","variant","badge","title","subtitle","highlight","description","cta_text","cta_path","image_url","bg_image_url","fallback_image_url","bg_gradient","emoji","code","accent","bg_color","gallery","display_order","is_active","starts_at","ends_at"]`. For the footer, build two CRUD routers and mount them at `/sections` and `/links`, then a custom `GET /` that fetches sections and links and nests them. Implement the reorder handlers with the shared `applyReorder` helper from `server/lib/crudRouter.js` (Task 2), which renumbers a complete ordered list and rejects a partial list with `400`. The four reorder routes are `PATCH /api/content/hero/reorder`, `PATCH /api/content/banners/reorder`, `PATCH /api/content/footer/sections/reorder` and `PATCH /api/content/footer/links/reorder` — the links scope is the set of links sharing the `section_id` of the ids in the body. Register each `/reorder` route **before** the matching `/:id` route.

- [ ] **Step 4: Mount the new routers**

In `server/app.js`, add `app.use("/api/content/banners", bannerRoutes)` and `app.use("/api/content/footer", footerRoutes)` alongside the existing `app.use("/api/content", contentRoutes)`. Register `/reorder` handlers **before** `/:id` handlers.

- [ ] **Step 5: Run the test to verify it passes, then the full gate**

Run: `npx vitest run server/routes/content.test.js` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/routes/content.js server/routes/content.test.js server/lib/crudRouter.js server/app.js
git commit -m "feat(api): partial updates, reorder and includeInactive for site content"
```

---

## Task 8: Menu API

**Files:**

- Modify: `server/routes/menu.js`
- Modify: `server/routes/menuTree.js` (only if the tree builder needs the new `category_id` field — it spreads all columns, so no change is expected)
- Create: `server/routes/menu.test.js`

**Interfaces:**

- Consumes: `createCrudRouter` (Task 2), `validateDepth` (Task 1).
- Produces:

  | Method | Path                | Auth   | Response                                                                                                                                                                             |
  | ------ | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | GET    | `/api/menu`         | public | bare array of tree roots (unchanged shape) — `?role=` filters by `roles_allowed`; `?includeInactive=1` + admin returns inactive rows too; `?flat=1` returns a flat array (unchanged) |
  | GET    | `/api/menu/:id`     | public | `{ item: {...} }`                                                                                                                                                                    |
  | POST   | `/api/menu`         | admin  | `200 { message, item }` — upsert by `id` (**this is the route the admin UI already calls and currently 404s on**)                                                                    |
  | PATCH  | `/api/menu/:id`     | admin  | `200 { message, item }` — partial                                                                                                                                                    |
  | DELETE | `/api/menu/:id`     | admin  | `200 { message }`                                                                                                                                                                    |
  | PATCH  | `/api/menu/reorder` | admin  | body `{ orders: [{id, display_order, parent_id, level}] }` — renumbers siblings                                                                                                      |

  **Ordering-column reconciliation (binding, see spec §3.6).** `menu_items` keeps its existing `order_index` column — do **not** add `display_order` to it and do **not** rename `order_index`. The request body key is `display_order` and the array order is authoritative, but the renumbered values are persisted to `order_index`, because that is what `buildMenuTree` and `GET /api/menu` already sort by. The menu CRUD router therefore sets `orderColumn: "order_index"`. List and single-item responses return the raw row, so menu rows carry `order_index`.

  The `POST /api/menu` handler must **also accept `PUT` on the same path** so the existing admin call `PUT /api/menu/:id` (`src/components/admin/MenuListEditor.jsx:56`) stops 404-ing — but Task 17 replaces that editor, so `PUT` support is optional. Prefer implementing `PATCH /api/menu/:id` and updating the editor.

- [ ] **Step 1: Write the failing test** `server/routes/menu.test.js` covering:
  - `GET /api/menu` returns a bare array (not a wrapped object).
  - `GET /api/menu?includeInactive=1` with an admin token returns inactive rows; without a token it returns `401`.
  - `PATCH /api/menu/:id` with `{title:"New"}` writes only `title`.
  - `PATCH /api/menu/reorder` with a complete sibling list renumbers them `0..n-1`; with a partial list → `400`.
  - `POST /api/menu` with `{title:"T", path:"/p", level:2}` and no `parent_id` → `400` naming the parent requirement.
  - `POST /api/menu` with a `category_id` that does not exist → `400` `"Category not found."`.
  - `DELETE /api/menu/:id` → `200 { message }`.
  - Writes without a token → `401`; with a `user` token → `403`.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/routes/menu.test.js`
Expected: FAIL — the routes are missing.

- [ ] **Step 3: Implement the changes in `server/routes/menu.js`**

  - Add `PATCH /:id` (partial update) and `GET /:id`.
  - Add `category_id` to the writable field list; validate it with a `categories` lookup when present.
  - Change `POST /` to **return the persisted row**: `const { data, error } = await supabase.from("menu_items").upsert(payload).select().single();` and respond `200 { message, item: data }`. **Currently the Supabase error is only `console.warn`ed and the route still returns `200` (`server/routes/menu.js:201`) — that must become a `500 { error }`.**
  - Change `GET /` to accept `includeInactive=1` (admin-guarded) and to stop filtering out inactive rows for admins.
  - Fix the reorder handler so it **renumbers** the affected sibling group: accept the full ordered list of sibling ids and write `display_order = index`. Reject a partial list with `400`.
  - Keep `buildMenuTree` in `server/routes/menuTree.js` unchanged — it already spreads every column, so `category_id` flows through automatically.

- [ ] **Step 4: Run the test to verify it passes, then the full gate**

Run: `npx vitest run server/routes/menu.test.js server/routes/menuTree.test.js server/routes/menuWriteErrors.test.js` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/routes/menu.js server/routes/menu.test.js
git commit -m "feat(api): menu partial update, includeInactive and working reorder"
```

---

## Task 9: Products bind to the taxonomy

**Files:**

- Modify: `server/routes/products.js:53-92`, `server/routes/products.js:111-166`, `server/routes/products.js:169-200`
- Modify: `src/components/admin/UnifiedAdminConsole.jsx:1910-1934` (admin product form category control)
- Modify: `src/components/vendor/VendorDashboard.jsx:414`, `src/components/vendor/VendorDashboard.jsx:630-631` (vendor product form + category filter)
- Create: `src/components/admin/CategoryPicker.jsx`
- Create: `src/components/admin/CategoryPicker.test.jsx`

**Interfaces:**

- Consumes: the `categories` table (Task 4).
- Produces:
  - `GET /api/products?categoryPath=<a/b/c>` — resolves the **path** to a category, expands to that category **and all descendants**, and filters `products.category_id` with `.in("category_id", ids)`. An unknown path returns `200` with an **empty array** and a `X-Category-Not-Found: true` response header so the client can distinguish "empty category" from "no such category".
  - `GET /api/products?categoryPath=<a/b/c>` — resolves the **path** to a category, expands to that category **and all descendants**, and filters `products.category_id` with `.in("category_id", ids)`. An unknown path returns `200` with an **empty array** and a `X-Category-Not-Found: true` response header so the client can distinguish "empty category" from "no such category".
  - `GET /api/products?categoryId=<uuid>` — the same expansion, keyed on the category's id instead of its path.
  - `GET /api/products?category=<free text>` — **not** the taxonomy filter. It keeps the existing `ilike("category", …)` behaviour, which matches the free-text `products.category` values the vendor dashboard still writes.
  - `POST /api/products` and `PUT /api/products/:id` accept an optional `category_id` (a `categories.id` UUID). When `category_id` is supplied and `category` text is not, `category` is filled from the category's `name`.
  - `GET /api/categories/:slug` already returns `descendants` (Task 6) so the client can filter locally without a second round trip.
  - A new shared component `src/components/admin/CategoryPicker.jsx`:
    ```jsx
    <CategoryPicker value={string|null} onChange={(categoryId: string|null, categoryName: string|null) => void} />
    ```
    It fetches `apiFetchCategoryTree()` once, renders a grouped `<select>` whose `<optgroup>` labels are the level-1 categories and whose options are the level-2 and level-3 categories indented by depth, and calls `onChange` with the selected id and its name. It must include a "— Uncategorised —" option with a `null` id. Both the admin product form and the vendor product form use it.
- [ ] **Step 1: Write the failing test** in a new file `server/routes/products.test.js`. Mock `../db.js`. Cover:
  - `GET /api/products?categoryPath=electronics` resolves the path, loads descendants, and calls `.in("category_id", [ids])` with the resolved ids.
  - `GET /api/products?categoryPath=does/not/exist` returns `200 []` and sets the `X-Category-Not-Found` header.
  - `GET /api/products?category=Electronics` (free text) still uses the `ilike` filter and does **not** call the categories table.
  - `GET /api/products` with no `category` param does **not** call the categories table at all.
  - `POST /api/products` with `{category_id:"<uuid>"}` and no `category` text writes `category` = the category's `name`.
  - `POST /api/products` with an unknown `category_id` → `400 { error: "Category not found." }`.
  - The existing `search` filter still works and still rejects a `,`/`.` injection attempt (the current `server/routes/products.js:76` interpolates `search` straight into a PostgREST `.or()` — escape `,` `.` `(` `)` before interpolating).
- [ ] **Step 1b: Write the failing test for the category picker**

  `src/components/admin/CategoryPicker.test.jsx` — mock `../api/contentApi`. Cover:
  - The options are grouped by level-1 category.
  - Selecting an option calls `onChange` with that category's id **and** its name.
  - The "— Uncategorised —" option calls `onChange(null, null)`.
  - When the tree fetch rejects, the component renders a disabled select with the error text, and does not crash.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/routes/products.test.js`
Expected: FAIL — the category filter is not implemented.

- [ ] **Step 3: Implement the product category binding**

  - In `server/routes/products.js:53-92`, the taxonomy filter is `req.query.categoryPath`. Resolve the path **exactly** by segment walk against `categories` (the level-1 row whose slug is segment 1, then its child whose slug is segment 2, and so on) — the same walk the categories route uses — collect that row's id plus all descendant ids, and filter with `.in("category_id", ids)`. A path that resolves to nothing returns `200 []` with `X-Category-Not-Found: true`. `req.query.categoryId` does the same, keyed on the id. `req.query.category` (free text, and the literal `"All"`) keeps the existing `ilike("category", ...)` path untouched — it is **not** the taxonomy filter and must not call the categories table.
  - Escape the `search` term before interpolating it into `.or(...)`: replace `,` `.` `(` `)` with a space.
  - In `POST` (`:111-166`) and `PUT` (`:169-200`), accept `category_id`; look up the category; if found and `category` text is absent, set `category = category.name`; if `category_id` is present but not found, return `400 { error: "Category not found." }`.

- [ ] **Step 4: Replace the hardcoded category dropdowns with the picker**

  Create `src/components/admin/CategoryPicker.jsx` (interface above) and use it in two places:
  - `src/components/admin/UnifiedAdminConsole.jsx:1910-1934` — replace the native `<select className="form-select-field">` whose 8 hardcoded options are `Electronics, Fashion, Home, Beauty, Wearables, Sports, Grocery, Toys` (`:1919-1932`) with `<CategoryPicker value={productForm.category_id} onChange={(id, name) => setProductForm(f => ({ ...f, category_id: id, category: name ?? f.category }))} />`. Keep the `category` text field in sync so `ProductCard` and the breadcrumb still show a human-readable label.
  - `src/components/vendor/VendorDashboard.jsx:630-631` — the vendor product form's category control becomes the same picker. The vendor's category **filter** at `:414` (currently derived from the distinct `p.category` values of the loaded products) becomes a picker-filter over the same tree.
  - The admin's catalog search over `p.category` (`UnifiedAdminConsole.jsx:481`) is unchanged — it searches the label text.

- [ ] **Step 5: Run the test to verify it passes, then the full gate**

Run: `npx vitest run server/routes/products.test.js src/components/admin/CategoryPicker.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/routes/products.js server/routes/products.test.js src/components/admin/CategoryPicker.jsx src/components/admin/CategoryPicker.test.jsx src/components/admin/UnifiedAdminConsole.jsx src/components/vendor/VendorDashboard.jsx
git commit -m "feat(api): filter products by category taxonomy and pick categories from the tree"
```

---

## Task 10: Frontend API client

**Files:**

- Create: `src/api/client.js`
- Create: `src/api/contentApi.js`
- Create: `src/api/client.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces:

  ```js
  // src/api/client.js
  export const API_BASE_URL = "/api";
  export function getStoredToken(): string | null;
  export function setStoredToken(token: string | null): void;
  export function onUnauthorized(listener: (status: number) => void): () => void;  // returns unsubscribe
  export async function apiFetch(path: string, options?: {
    method?: "GET"|"POST"|"PATCH"|"PUT"|"DELETE",
    body?: unknown,
    formData?: FormData,
    auth?: boolean,      // default true
  }): Promise<any>;
  ```

  `apiFetch` resolves the parsed JSON body on 2xx and **throws** an `Error` with `.status` and `.body` on anything else. It attaches `Authorization: Bearer <token>` when `auth !== false` and a token exists. On a `401` it notifies every `onUnauthorized` listener exactly once per response. It never returns `[]` or `null` to paper over an error.

  ```js
  // src/api/contentApi.js
  apiFetchHeroSlides(opts?: { includeInactive?: boolean }): Promise<{ slides: HeroSlide[] }>
  apiSaveHeroSlide(slide: object): Promise<{ slide: HeroSlide }>
  apiUpdateHeroSlide(id: string, patch: object): Promise<{ slide: HeroSlide }>
  apiDeleteHeroSlide(id: string): Promise<{ message: string }>
  apiReorderHeroSlides(orders: { id: string; display_order: number }[]): Promise<{ message: string }>
  apiFetchCategories(opts?: { includeInactive?: boolean }): Promise<{ categories: Category[] }>
  apiFetchCategoryTree(opts?: { includeInactive?: boolean }): Promise<{ categories: CategoryNode[] }>
  apiFetchCategoryBySlug(slug: string): Promise<{ category: Category; ancestors: Category[]; descendants: Category[]; ambiguous?: boolean }>
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
  apiReorderMenuItems(orders: { id: string; display_order: number; parent_id?: string|null; level?: number }[]): Promise<{ message: string }>
  apiUploadImage(file: File, folder?: string): Promise<{ url: string; public_id: string }>
  ```

  `apiFetchMenuItems` returns a **bare array** (matching the existing `GET /api/menu` response shape).

- [ ] **Step 1: Write the failing test** `src/api/client.test.js`. Stub `global.fetch` with `vi.fn()`. Cover:
  - A successful GET returns the parsed body.
  - A `500` response throws an `Error` whose `.status` is `500` and whose `.message` is the server's `error` string.
  - A request with a token in `localStorage["marvel_jwt_token"]` sends `Authorization: Bearer <token>`.
  - A request with `auth: false` sends no `Authorization` header.
  - A `401` calls the `onUnauthorized` listener once.
  - A network rejection throws.
  - `apiFetch` with a `FormData` body does **not** set a `Content-Type` header.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/api/client.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/api/client.js`**

Read the token from `localStorage["marvel_jwt_token"]`. Build the URL as `${API_BASE_URL}${path}`. Set `Content-Type: application/json` only when `body` is present and is not a `FormData`. On a non-2xx response, parse the body as JSON when possible and throw `new Error(body?.error || \`Request failed with status ${status}\`)`with`.status`and`.body`attached. On`401`, call every registered listener. Return `undefined`for a`204`.

- [ ] **Step 4: Implement `src/api/contentApi.js`**

One thin function per entry in the interface list, each calling `apiFetch` with the right method, path, and body. Use `URLSearchParams` for the query parameters. `apiFetchMenuItems` calls `apiFetch(\`/menu?role=${role}\`)` and returns the array directly.

- [ ] **Step 5: Wire `onUnauthorized` to the auth context**

In `src/context/AuthContext.jsx`, register a listener with `onUnauthorized` that clears the stored token via `setStoredToken(null)`, resets the user state, and sets `window.location.hash = "#/login"`. Return the unsubscribe function from the effect's cleanup. This is what makes an expired or revoked token log the user out instead of leaving the UI half-authenticated — today there is no global 401 handler anywhere (`src/api/backendApi.js` ignores 401 on every call except `apiGetMe`).

- [ ] **Step 6: Run the test to verify it passes, then the full gate**

Run: `npx vitest run src/api/client.test.js` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/api/client.js src/api/contentApi.js src/api/client.test.js src/context/AuthContext.jsx
git commit -m "feat(client): typed API client and content transport"
```

---

## Task 11: ContentContext

**Files:**

- Create: `src/context/ContentContext.jsx`
- Create: `src/context/ContentContext.test.jsx`
- Modify: `src/App.jsx:285-295` (provider tree)

**Interfaces:**

- Consumes: `src/api/contentApi.js` (Task 10).
- Produces:

  ```js
  export function ContentProvider({ children }: { children: React.ReactNode }): JSX.Element;
  export function useContent(): {
    hero: HeroSlide[],
    banners: Banner[],
    categories: Category[],          // flat, active only
    categoryTree: CategoryNode[],    // nested, active only
    footer: { sections: FooterSection[]; links: FooterLink[] },
    menu: MenuNode[],
    loading: boolean,
    error: string | null,
    refresh: () => Promise<void>,
  };
  ```

  `ContentProvider` fetches hero, banners, categories (flat **and** tree), footer, and menu **once** on mount, in parallel. It exposes `loading` (true until the first settled load) and `error` (the first error message, or `null`). `refresh()` re-runs all five fetches and is exposed for the admin console's "preview after edit" action. The provider **does not** throw on failure — it sets `error` and leaves the collections empty.
  The provider also listens for the `window` event `marvel_content_updated` (dispatched by the admin editors in Tasks 15-17 after a successful write) and calls `refresh()` when it fires — that is the admin→storefront live update channel. The listener must be removed on unmount.

- [ ] **Step 1: Write the failing test** `src/context/ContentContext.test.jsx`. Mock `../api/contentApi`. Cover:
  - On mount, all five fetchers are called once each.
  - `useContent().hero` returns the fetched slides.
  - When the hero fetch rejects, `error` is a non-empty string and `loading` is `false`; the other collections still populate.
  - `refresh()` re-invokes all five fetchers.
  - Dispatching a `marvel_content_updated` `window` event triggers `refresh()`.
  - The component does not throw when a fetch rejects.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/context/ContentContext.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/context/ContentContext.jsx`**

Use `useEffect` with an empty dependency array and a `cancelled` flag so a late response after unmount does not call `setState`. Wrap each fetch in its own `try/catch` so one failure does not blank the other collections. Store the results in a single `useState` object. `refresh` re-runs the same loader. A second `useEffect` registers a `window.addEventListener("marvel_content_updated", refresh)` and removes it in its cleanup.

- [ ] **Step 4: Mount the provider**

In `src/App.jsx`, wrap the existing tree so `ContentProvider` sits **above** `AuthProvider` (content does not depend on auth, but the admin console's menu preview does):

```jsx
<ToastProvider>
  <ContentProvider>
    <AuthProvider>
      <CartProvider>
        <AppMain />
```

- [ ] **Step 5: Run the test to verify it passes, then the full gate**

Run: `npx vitest run src/context/ContentContext.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/context/ContentContext.jsx src/context/ContentContext.test.jsx src/App.jsx
git commit -m "feat(client): ContentProvider loads all site content once"
```

---

## Task 12: Category landing page and routing

**Files:**

- Create: `src/components/category/CategoryPage.jsx`
- Create: `src/components/category/CategoryPage.test.jsx`
- Modify: `src/App.jsx:38-47` (route parsing), `src/App.jsx:110-118` (page switch), `src/App.jsx:77-96` (`handleDynamicMenuClick`)

**Interfaces:**

- Consumes: `useContent()` (Task 11), `apiFetchProducts` from `src/api/backendApi.js` (until Task 13 migrates it; after that it moves to `src/api/productsApi.js`).
- Produces:
  - A new hash route `#/category/<full path>` — for example `#/category/electronics/mobiles/smartphones`. `getHashRoute` (`src/App.jsx:38-47`) must recognise a first segment of `category` and pass **the entire remainder after `category/`** as the path, URL-decoded, with the leading `/category/` stripped. The current parser only keeps `parts[0]` and `parts[1]`, and `category` currently falls through to `navigateTo("")` at `:93-95` — that silent bounce must be replaced with a route to the category page.
  - **The route is the full ancestor path, not a bare slug.** Slugs are unique only per parent, so `accessories` exists 3× in the seeded tree and `watches` 2×; a last-segment-only route would send _Electronics › Accessories_ to the root Accessories page. The path is the identity.
  - `CategoryPage` props: `{ path: string }`. It resolves the category from `useContent().categoryTree` when the tree contains the path (each node's ancestor-joined path is computed locally), and falls back to `apiFetchCategoryByPath(path)` otherwise. It then fetches products via `apiFetchProducts({ categoryPath: path })`, and renders: a breadcrumb (`Home / <ancestor titles> / <category name>`), the category title and description, the list of subcategories (from `descendants` at level = category.level + 1) as clickable chips, and a `ProductCard` grid.
  - Loading state, empty state ("No products in this category yet.") and error state are all distinct and visible.
  - Clicking a subcategory chip navigates to `#/category/<child's full ancestor path>` — the chip's path is the parent's path plus `/` plus the child's slug.
  - `handleDynamicMenuClick` must route a `category/...` path to `#/category/<the remainder after `/category/`>` instead of `navigateTo("")`. `menu_items.path` already **is** the full path, so this is a string strip: remove the leading `/category/` and append the rest. A path that matches no category must show the category page's "unknown category" empty state rather than bouncing home.

- [ ] **Step 1: Write the failing test** `src/components/category/CategoryPage.test.jsx`. Mock `../api/contentApi` and the products fetch. Cover:
  - Renders the category name and its subcategory chips.
  - Renders the products returned by the product fetch.
  - Shows the empty state when the product list is empty.
  - Shows the error state when the product fetch rejects.
  - Clicking a subcategory chip calls the navigate callback with the child's **full ancestor path**, not its bare slug.
  - Resolves the category from `categoryTree` without calling `apiFetchCategoryByPath` when the tree contains the path.
  - Falls back to `apiFetchCategoryByPath` when the tree does not contain it.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/category/CategoryPage.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CategoryPage.jsx`**

Follow the pattern of `src/components/product/ProductViewPage.jsx` (loading + error + content states, `ProductCard` grid). Resolve the path locally against `useContent().categoryTree` first, and fall back to `apiFetchCategoryByPath` for the ancestors/descendants.

- [ ] **Step 4: Wire the route in `src/App.jsx`**

  - Extend `getHashRoute` to return `{ page, id }` where `page === "category"` and `id` is the **full path** (everything after `category/`) when the path starts with `category/`.
  - Add a `category` branch to the page switch at `:110-118` rendering `<CategoryPage path={currentRoute.id} onNavigate={handleDynamicMenuClick} />`.
  - In `handleDynamicMenuClick` (`:77-96`), add a branch before the final `else`: when the cleaned path starts with `category/`, strip the leading `/category/` and `navigateTo("category", remainder)`.
  - Add a `category` entry to the page titles / document title logic if one exists.

- [ ] **Step 5: Run the test to verify it passes, then the full gate**

Run: `npx vitest run src/components/category/CategoryPage.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/category/CategoryPage.jsx src/components/category/CategoryPage.test.jsx src/App.jsx
git commit -m "feat(storefront): category landing page with working category routing"
```

---

## Task 13: Storefront consumes the content context

**Files:**

- Modify: `src/components/HeroBanner.jsx`, `src/components/CategorySlider.jsx`, `src/components/BannerLayout.jsx`, `src/components/PromoBannerCarousel.jsx`, `src/components/Footer.jsx`, `src/components/HoverNav.jsx`, `src/components/navigation/DynamicMenu.jsx`, `src/components/BrowseCategoriesMenu.jsx`, `src/components/MobileMenu.jsx`
- Delete: `src/data.js`, `src/components/ui/MegaMenu.jsx`, `src/components/Navbar.jsx`, `src/components/Sidebar.jsx`, `src/components/CategoryScroll.jsx`, `src/components/VerticalCategoryMenu.jsx`, `src/components/PromoBanners.jsx`, `src/components/FeatureBanners.jsx`, `src/components/SaleBanner.jsx`, `src/components/ProductSection.jsx`
- Modify: `src/api/backendApi.js` (shrink to the product/auth/cart functions still in use)

**Interfaces:**

- Consumes: `useContent()` (Task 11).
- Produces: every storefront surface renders from `useContent()` and no longer imports `src/data.js`. `HeroBanner` renders `btn_path` on its CTA button — it is mapped at `src/components/HeroBanner.jsx:14` but **never used** at `:129-137`; wire it. `CategorySlider` navigates to `#/category/<slug>` on click — it currently maps only `name` and `image_url` and drops the `path` at `src/components/CategorySlider.jsx:20`.

- [ ] **Step 1: Write the failing test** `src/components/ContentDrivenSurfaces.test.jsx` (new). Mock `../context/ContentContext` with `useContent` returning a fixed payload. Cover:
  - `HeroBanner` renders the hero title from the context and its CTA calls `onNavigate` with the slide's `btn_path`.
  - `CategorySlider` renders the categories that have `show_in_homepage: true` and **excludes** those that do not.
  - `BannerLayout` renders the `home_banner_layout` banners, one `large` and two `small`.
  - `PromoBannerCarousel` renders the `home_promo_carousel` banners and their `gallery` images.
  - `Footer` renders the footer section headings and their links from the context, and does **not** render the hardcoded `"Customer Support"` literal when the context supplies a different heading.
  - `HoverNav` renders the menu roots from the context.
  - `BrowseCategoriesMenu` renders the categories from `categoryTree` with their children.
  - When `useContent().error` is set, each surface renders an explicit empty state rather than crashing.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ContentDrivenSurfaces.test.jsx`
Expected: FAIL — the surfaces still read from `data.js` / their own fetches.

- [ ] **Step 3: Migrate each surface**

  - `HeroBanner.jsx` — drop the `apiFetchHeroSlides` effect and the `data.js` import; read `const { hero } = useContent();`. Render `btn_path` on the CTA. If `hero` is empty, render a static hero slide defined **inline in the component** (a hardcoded emergency fallback, ~8 lines) so the homepage is never blank — this is the only place a static fallback is kept, per the spec.
  - `CategorySlider.jsx` — read `categories` from the context, filter to `show_in_homepage === true`, and navigate to `#/category/${path}` on click, where `path` is the category's **full ancestor path** (for a level-1 category that is just its slug).
  - `BannerLayout.jsx` — read `banners`, filter to `placement === "home_banner_layout"`, sort by `display_order`, and use `variant` to pick the large vs small slot. If fewer than 3 banners exist, render only what is present.
  - `PromoBannerCarousel.jsx` — read `banners`, filter to `placement === "home_promo_carousel"`. Replace the hardcoded `"⚡ ENDS IN 04H 22M"` (`src/components/PromoBannerCarousel.jsx:45`) with a countdown computed from the banner's `ends_at` when present, falling back to the literal only when `ends_at` is null.
  - `Footer.jsx` — replace `COLS`, `SEARCH_TAGS` and their rendering with `footer.sections` and `footer.links` from the context. Keep the value-prop bar, the social block, the payment chips and the copyright line **as code** (out of scope per the spec). Render the `"Popular Searches"` section as tags using `section_type === "tags"`.
  - `HoverNav.jsx` — delete its own `apiFetchMenuItems` effect; read `menu` from the context. Keep its own layout (it differs from `DynamicMenu`).
  - `navigation/DynamicMenu.jsx` — delete its own fetch and its `data.js` fallback; read `menu` from the context. Keep `normalizeToTree` for the case where the API returns a flat array.
  - `BrowseCategoriesMenu.jsx` and `MobileMenu.jsx` — read `categoryTree` from the context; drop the `data.js` import.

- [ ] **Step 4: Delete the dead files and shrink `backendApi.js`**

  Delete the ten files listed under **Files**. For `src/api/backendApi.js`, remove every content/menu function that `src/api/contentApi.js` now owns, keeping only the auth, product, cart and upload helpers. Update the remaining importers. `src/components/ui/MegaMenu.jsx` is deleted because `navigation/DynamicMenu.jsx` already renders the live mega menu; verify no other file imports it (grep for `ui/MegaMenu`).

- [ ] **Step 5: Verify no importer of `src/data.js` remains**

Run: `grep -rn "from \"../data\"\|from \"./data\"\|from \"../../data\"" src/` → Expected: **no output**.
Run: `grep -rn "data.js" src/` → Expected: no output.

- [ ] **Step 6: Run the test to verify it passes, then the full gate**

Run: `npx vitest run src/components/ContentDrivenSurfaces.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat(storefront): all content surfaces read from the content context"
```

---

## Task 14: Content editor kit

**Files:**

- Create: `src/components/admin/ContentEditorKit.jsx`
- Create: `src/components/admin/ContentEditorKit.test.jsx`

**Interfaces:**

- Consumes: `src/components/ui` (`Button`, `Input`, `useToast`), `src/components/ui/ImageUploadDropzone.jsx`, `src/components/admin/ConfirmDialog.jsx`.
- Produces these components:

  ```jsx
  <ImageField label="Banner image" value={string|null} onChange={(url: string|null) => void}
              folder="marvel_content" />   // uploads via apiUploadImage, shows the returned url
  <OrderControls index={number} total={number} onMove={(from: number, to: number) => void} />
  <ActiveToggle active={boolean} onChange={(active: boolean) => void} />
  <EditorTable columns={string[]} rows={object[]} onEdit={} onDelete={} onToggleActive={} />
  ```

  `ImageField` must show the current URL, an "Upload" button that opens the existing `ImageUploadDropzone`, and a "Clear" button. It must display the error returned by `apiUploadImage` rather than failing silently. It must not label the value "signed_url" — the upload endpoint returns `url` (`server/routes/upload.js:33`).

- [ ] **Step 1: Write the failing test** `src/components/admin/ContentEditorKit.test.jsx`. Cover:
  - `ImageField` renders the current value.
  - Clicking Upload and selecting a file calls `apiUploadImage` and then `onChange` with the returned `url`.
  - When `apiUploadImage` rejects, an error message is rendered and `onChange` is not called.
  - `OrderControls` calls `onMove` with the adjacent index and is disabled at the boundaries.
  - `ActiveToggle` calls `onChange` with the inverted boolean.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/ContentEditorKit.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ContentEditorKit.jsx`**

Four small exported components in one file (they are a single cohesive kit). `ImageField` holds the `ImageUploadDropzone` open/closed state and an `error` string. `OrderControls` renders two buttons with the `ArrowUp` / `ArrowDown` Lucide icons and the `aria-label`s `"Move up"` / `"Move down"`, disabled at index 0 and `total - 1`. `ActiveToggle` renders a `Button` with `aria-pressed` reflecting `active`. `EditorTable` renders a `<table>` with a header row built from `columns` and a row per item, each row exposing an Edit button, a Delete button (which calls the `ConfirmDialog`) and an `ActiveToggle`.

- [ ] **Step 4: Run the test to verify it passes, then the full gate**

Run: `npx vitest run src/components/admin/ContentEditorKit.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ContentEditorKit.jsx src/components/admin/ContentEditorKit.test.jsx
git commit -m "feat(admin): shared content editor kit"
```

---

## Task 15: Categories tree editor

**Files:**

- Create: `src/components/admin/CategoriesTreeEditor.jsx`
- Create: `src/components/admin/CategoriesTreeEditor.test.jsx`
- Delete: `src/components/admin/CategoriesEditor.jsx`
- Modify: `src/components/admin/UnifiedAdminConsole.jsx:2345` (mount the new editor), `:768-777` (`TAB_LABELS`), `:1080-1139` (sidebar)

**Interfaces:**

- Consumes: `src/api/contentApi.js` (Task 10), `ContentEditorKit` (Task 14).
- Produces: `CategoriesTreeEditor` renders the 3-level category tree from `apiFetchCategoryTree({ includeInactive: true })`, with:
  - An add-child button on every node (disabled at level 3).
  - An inline form (or modal) with fields: `name` (required), `slug` (auto-derived from the name via `slugify` but editable), `parent_id` (a `<select>` of valid parents — level 1 has no parent, level 2 picks a level-1 category, level 3 picks a level-2 category), `icon`, `image_url` (via `ImageField`), `banner_image_url` (via `ImageField`), `description`, `display_order` (via `OrderControls`), `is_active` (via `ActiveToggle`), `show_in_nav`, `show_in_homepage`.
  - A delete button per node, behind a `ConfirmDialog` that states the number of descendants that will also be deleted.
  - Up/down reordering **within a sibling group**, sending the complete ordered sibling list to `apiReorderCategories`.
  - A "Show hidden" toggle that includes or excludes `is_active = false` rows.
  - **Save must send `id` when editing** so the server upserts rather than inserting a duplicate. The current `MenuListEditor` drops `badge_variant` on every save (`src/components/admin/MenuListEditor.jsx:54`) — do not repeat that class of bug: the category payload must include every field the form owns.
- [ ] **Step 1: Write the failing test** `src/components/admin/CategoriesTreeEditor.test.jsx`. Mock `../api/contentApi`. Cover:
  - The tree renders the fetched nodes with their children.
  - Clicking "Add subcategory" on a level-1 node opens a form whose parent is that node.
  - The add-child button is disabled on a level-3 node.
  - Saving a new category calls `apiSaveCategory` with `{ name, slug, parent_id, level }` and the exact typed values.
  - Editing a category calls `apiUpdateCategory(id, patch)` — **not** `apiSaveCategory` — and the patch contains only the changed fields.
  - The hidden-category filter: with "Show hidden" on, an `is_active: false` node is rendered.
  - Deleting a node calls `apiDeleteCategory` **only after** the `ConfirmDialog` is confirmed.
  - A save failure shows a toast and leaves the form open (does not silently close — the current `MenuListEditor` closes the modal before the request at `:51`).
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/CategoriesTreeEditor.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CategoriesTreeEditor.jsx`**

Model the structure on `src/components/admin/MenuTreeEditor.jsx` (which is the one editor that gets nesting and reordering right) but use `ContentEditorKit` for the shared parts and `contentApi` for transport. Derive `level` from the selected parent (`parent.level + 1`, or `1` for a root). Auto-fill `slug` from `name` with `slugify` whenever the name changes and the slug has not been manually edited.

- [ ] **Step 4: Wire it into the admin console and delete the old editor**

  In `src/components/admin/UnifiedAdminConsole.jsx`:
  - Import `CategoriesTreeEditor` near `:82-84`.
  - Add `categories: "Site Content — Categories"` to `TAB_LABELS` (`:768-777`) if the key differs from the current one.
  - Replace the `<CategoriesEditor />` render at `:2345` with `<CategoriesTreeEditor />`.
  - Update the sidebar submenu label for the categories entry (`:1129-1138`) to "Categories & Subcategories".
  - Delete `src/components/admin/CategoriesEditor.jsx`.

- [ ] **Step 5: Run the test to verify it passes, then the full gate**

Run: `npx vitest run src/components/admin/CategoriesTreeEditor.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/admin/
git commit -m "feat(admin): 3-level category tree editor"
```

---

## Task 16: Banners and footer editors

**Files:**

- Create: `src/components/admin/BannersEditor.jsx`
- Create: `src/components/admin/BannersEditor.test.jsx`
- Create: `src/components/admin/FooterEditor.jsx`
- Create: `src/components/admin/FooterEditor.test.jsx`
- Modify: `src/components/admin/UnifiedAdminConsole.jsx` (import, `TAB_LABELS`, sidebar, render blocks)

**Interfaces:**

- Consumes: `src/api/contentApi.js`, `ContentEditorKit` (Task 14).
- Produces:
  - `BannersEditor` — a placement selector with three tabs (`home_banner_layout`, `home_promo_carousel`, `promo_strip`). For each placement it lists the banners via `apiFetchBanners({ placement, includeInactive: true })` and offers a form with the fields relevant to that placement:
    - `home_banner_layout`: `title`, `subtitle`, `cta_text`, `cta_path`, `image_url`, `variant` (`large` | `small`), `display_order`, `is_active`.
    - `home_promo_carousel`: `badge`, `title`, `highlight`, `description`, `cta_text`, `cta_path`, `gallery` (a list of image URLs, each added through `ImageField`), `display_order`, `is_active`, `ends_at` (a `datetime-local` input).
    - `promo_strip`: `title`, `subtitle`, `emoji`, `code`, `accent`, `bg_color`, `cta_text`, `cta_path`, `display_order`, `is_active`.
    - It must also let an admin set `placement` when creating a new banner, and changing the placement reloads the list.
  - `FooterEditor` — two panes. The left pane lists `footer.sections` (heading, `section_type`, `column_index`, `display_order`, `is_active`) with add/edit/delete. The right pane lists the `footer.links` belonging to the selected section (label, href, `display_order`, `is_active`) with add/edit/delete and up/down ordering. Deleting a section cascades to its links (the FK is `ON DELETE CASCADE`) — the confirm dialog must say so.
- [ ] **Step 1: Write the failing tests**

  `BannersEditor.test.jsx`:
  - Lists the banners for the selected placement.
  - Switching the placement refetches with the new `placement` query parameter.
  - Saving a `home_promo_carousel` banner sends `gallery` as an array of strings.
  - Editing a banner calls `apiUpdateBanner(id, patch)`.
  - The `ends_at` value is sent as an ISO string.
  - A save failure toasts and keeps the form open.

  `FooterEditor.test.jsx`:
  - Lists the sections; selecting one lists that section's links.
  - Adding a link sends `section_id` of the selected section.
  - Deleting a section shows a confirm dialog that mentions its links.
  - Reordering links calls `apiReorderCategories`-style reorder with the complete sibling list — the footer links use `apiReorderFooterLinks` (add it to `src/api/contentApi.js` in this task, mirroring the hero/banners reorder signature: `orders: { id, display_order }[]`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/BannersEditor.test.jsx src/components/admin/FooterEditor.test.jsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both editors**

  Use `ContentEditorKit` for the table, image field, order controls, and active toggle. Use `useToast` for success and failure. Refetch the affected collection after every successful mutation (the existing editors' pattern).

- [ ] **Step 4: Wire both into the admin console**

  In `src/components/admin/UnifiedAdminConsole.jsx`, each new editor needs **four** coordinated edits (there is no tab registry):
  1. The import at `:82-84`.
  2. A `TAB_LABELS` entry at `:768-777` — `banners: "Site Content — Banners"`, `footer: "Site Content — Footer"`.
  3. The sidebar submenu button at `:1106-1139` and the parent's active-check array at `:1088`/`:1101` (currently `["menus","hero","categories"]`) — add `"banners"` and `"footer"`.
  4. The render block at `:2337-2345` — `{activeTab === "banners" && canManageSiteContent && <BannersEditor />}` and the same for `"footer"`.

- [ ] **Step 5: Run the tests to verify they pass, then the full gate**

Run: `npx vitest run src/components/admin/BannersEditor.test.jsx src/components/admin/FooterEditor.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/admin/ src/api/contentApi.js
git commit -m "feat(admin): banner and footer content editors"
```

---

## Task 17: Menu tree editor and hero editor

**Files:**

- Modify: `src/components/admin/MenuTreeEditor.jsx`
- Modify: `src/components/admin/HeroSlidesEditor.jsx`
- Delete: `src/components/admin/MenuListEditor.jsx`
- Delete: `src/components/admin/AdminDashboard.jsx`
- Delete: `src/components/admin/charts/SalesGrowthCard.jsx`
- Modify: `src/components/admin/UnifiedAdminConsole.jsx:82-84`, `:2338`

**Interfaces:**

- Consumes: `src/api/contentApi.js`, `ContentEditorKit` (Task 14).
- Produces:
  - `MenuTreeEditor` becomes the mounted menu editor, fixed:
    - Send `is_active` on save (it is currently only sent on the toggle path — `src/components/admin/MenuTreeEditor.jsx:224-246`).
    - Do not drop `badge_variant` on save.
    - Use `apiUpdateMenuItem(id, patch)` for edits and `apiSaveMenuItem(item)` for creates.
    - Reorder must send the **complete** sibling list so the server can renumber.
    - Add a `category_id` field: a `<select>` of the level-2 and level-3 categories. When set, the `path` auto-derives to the category's full path (`/category/<ancestor slugs>/<slug>`).
    - The delete confirmation text must not claim children are deleted — `DELETE /api/menu/:id` deletes only that row while the `menu_items.parent_id` FK cascades. Either make the delete cascade explicit in the API or correct the text.
    - Dispatch the `marvel_menu_updated` window event after every successful write so the storefront refreshes (it already does this at `:155-157`; keep it and extend it to the banners/categories editors as a `marvel_content_updated` event).
  - `HeroSlidesEditor` is refactored onto `ContentEditorKit`:
    - Use `ImageField` instead of the "paste signed_url" text inputs (`:320-352`) — the label is wrong; the endpoint returns `url`.
    - Add up/down ordering (hero slides currently have only a numeric `order_index` input and no move buttons).
    - Use `apiUpdateHeroSlide` for edits.
  - `MenuListEditor.jsx` is deleted; `UnifiedAdminConsole.jsx:2338` renders `<MenuTreeEditor role={isSuperAdmin ? "super_admin" : currentRole || "admin"} />` instead.
  - `AdminDashboard.jsx` and `SalesGrowthCard.jsx` are deleted (both are unreferenced dead code).

- [ ] **Step 1: Write the failing test** in `src/components/admin/MenuTreeEditor.test.jsx` (extend the existing file). Cover:
  - Editing a menu item calls `apiUpdateMenuItem(id, patch)` and the patch includes `is_active`.
  - Saving a new menu item calls `apiSaveMenuItem` with the full field set including `badge_variant`.
  - Reordering siblings calls `apiReorderMenuItems` with the complete ordered list of sibling ids.
  - Setting a `category_id` updates the `path` field to the category's full path.
  - A successful write dispatches the `marvel_menu_updated` window event.
- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/MenuTreeEditor.test.jsx`
Expected: FAIL — the editor still calls the old helpers.

- [ ] **Step 3: Fix `MenuTreeEditor.jsx`**

  Replace the `backendApi` menu calls with `contentApi` calls, add the `category_id` select (fed by `apiFetchCategoryTree()` filtered to levels 2 and 3), include `is_active` in the save payload, and fix the reorder payload to include every sibling.

- [ ] **Step 4: Refactor `HeroSlidesEditor.jsx`**

  Replace the URL text inputs with `ImageField`, add `OrderControls`, and switch to `apiUpdateHeroSlide` for edits. Keep the existing required-title validation and the delete confirmation.

- [ ] **Step 5: Delete the dead files and re-point the admin console**

  Delete `MenuListEditor.jsx`, `AdminDashboard.jsx`, `charts/SalesGrowthCard.jsx`. In `UnifiedAdminConsole.jsx:82-84` remove the `MenuListEditor` import and add `MenuTreeEditor`; at `:2338` render `<MenuTreeEditor ... />`. Remove the now-unused `SalesGrowthCard` import if present.

- [ ] **Step 6: Verify no dangling imports remain**

Run: `grep -rn "MenuListEditor\|AdminDashboard\|SalesGrowthCard" src/` → Expected: no output (except, if any, a comment).

- [ ] **Step 7: Run the test to verify it passes, then the full gate**

Run: `npx vitest run src/components/admin/MenuTreeEditor.test.jsx src/components/admin/HeroSlidesEditor.test.jsx` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/admin/
git commit -m "fix(admin): mount the working menu tree editor, fix hero editor and drop dead consoles"
```

---

## Task 18: Authorization tests for every touched route

**Files:**

- Create: `server/routes/authz.test.js`

**Interfaces:**

- Consumes: every router built in Tasks 3, 6, 7, 8.
- Produces: one parameterized test file that asserts, for every write route in the content surface, that an anonymous request gets `401` and a `user`-role token gets `403` — and that the database was not written.

  The route list to cover:
  `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id`,
  `POST /api/content/hero`, `PATCH /api/content/hero/:id`, `DELETE /api/content/hero/:id`, `PATCH /api/content/hero/reorder`,
  `POST /api/content/banners`, `PATCH /api/content/banners/:id`, `DELETE /api/content/banners/:id`, `PATCH /api/content/banners/reorder`,
  `POST /api/content/footer/sections`, `PATCH /api/content/footer/sections/:id`, `DELETE /api/content/footer/sections/:id`,
  `POST /api/content/footer/links`, `PATCH /api/content/footer/links/:id`, `DELETE /api/content/footer/links/:id`,
  `POST /api/menu`, `PATCH /api/menu/:id`, `DELETE /api/menu/:id`, `PATCH /api/menu/reorder`,
  `POST /api/upload`.

- [ ] **Step 1: Write the failing test**

  `server/routes/authz.test.js` mocks `../db.js` and signs real tokens with `signUserToken` (role `user` and role `admin`). For each route in the list, assert:
  - No `Authorization` header → `401` and a body with an `error` key.
  - A `user`-role token → `403`.
  - The mocked Supabase client's write methods were **not** called.
    Run this with `it.each(...)` over the route table.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/routes/authz.test.js`
Expected: FAIL for at least `POST /api/upload` (it currently has no auth guard) — and it must pass for the content routes already guarded.

- [ ] **Step 3: Add the missing guards**

  Every route in the list must be wrapped in `[verifyToken, requireRole(["admin","super_admin"])]` (the upload route additionally allows `"vendor"`). Where a route is not yet guarded, add the guard.

- [ ] **Step 4: Run the test to verify it passes, then the full gate**

Run: `npx vitest run server/routes/authz.test.js` then `npm run check`.
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/routes/authz.test.js server/routes/
git commit -m "test(security): assert every content write route rejects non-admins"
```

---

## Task 19: End-to-end verification

**Files:**

- Create: `tests/category-page.spec.js`
- Create: `tests/admin-content.spec.js`
- Modify: `tests/site-content.spec.js`
- Modify: `playwright.config.js`

**Interfaces:**

- Consumes: the running app (Vite on `:5173`, API on `:5000`).
- Produces:
  - `tests/category-page.spec.js` — navigate to `#/category/<slug>`; assert the category name renders, the subcategory chips render, and the product grid renders. Assert that a `/category/...` link in the nav lands on the category page and **not** on the homepage (this is the regression the current `src/App.jsx:93-95` silent bounce causes).
  - `tests/admin-content.spec.js` — log in as an admin, open Site Content → Banners, edit a banner title, save, reload the storefront, and assert the new title appears. Same for a category name. These are the round-trip tests that prove the feature works end to end.
  - `tests/site-content.spec.js` — update the existing mocks to the new response shapes (`{ categories: [...] }` for the categories endpoint, `{ banners: [...] }` for banners) and add a case asserting the hero CTA navigates to the slide's `btn_path`.
  - `playwright.config.js` — add a second `webServer` entry for the API (`npm run api`) so the live-dependent specs can run. **In CI, the API needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; add them as repository secrets and document that `tests/admin-content.spec.js` is skipped when `ADMIN_EMAIL` / `ADMIN_PASSWORD` are not set** — otherwise the CI browser job keeps failing on the two live specs (`tests/gallery.spec.js:4-5` and `tests/admin-console.spec.js:8-11`).
- [ ] **Step 1: Write the failing e2e specs** (the files listed above).
- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test tests/category-page.spec.js tests/admin-content.spec.js`
Expected: FAIL — the category route does not exist and the round-trip does not work.

- [ ] **Step 3: Fix whatever the specs expose** — do not weaken the assertions.
- [ ] **Step 4: Run the whole e2e suite**

Run: `npm run test:e2e`
Expected: PASS.

The DB-backed specs (`tests/category-page.spec.js`, `tests/admin-content.spec.js`, and the two pre-existing live-dependent specs `tests/gallery.spec.js` and `tests/admin-console.spec.js`) require the new tables to exist. **The human partner applies `docs/sql/apply-01-content-taxonomy.sql` and runs the seeds (`docs/sql/apply-03-run-seeds.md`) before those specs can pass.** Until then, those specs must **skip with an explicit reason** ("database schema not applied — run docs/sql/apply-01-content-taxonomy.sql"), not fail and not be silently skipped. Gate the skip on a cheap environment probe — for example, a request to `GET /api/categories` returning `200` with a non-empty `categories` array — rather than on a hard-coded flag, so the specs start passing by themselves the moment the schema is applied. Do **not** mark them `test.skip` unconditionally: a skip that hides a real failure is worse than a red test.

- [ ] **Step 5: Commit**

```bash
git add tests/ playwright.config.js
git commit -m "test(e2e): category page and admin content round-trip"
```

---

## Task 20: Documentation and final gate

**Files:**

- Modify: `README.md`
- Create: `docs/admin-content-guide.md`

**Interfaces:**

- Consumes: the finished feature.
- Produces: documentation of the content model, the admin workflow, the seed scripts, and the env vars.

- [ ] **Step 1: Write the docs**

  `README.md` — add a "Dynamic Site Content" section: what an admin can edit (hero slides, navigation tree, banners, footer links, categories and subcategories), the three-level taxonomy, and the seeding commands.
  `docs/admin-content-guide.md` — a step-by-step admin guide: how to add a category, how to attach a product to it, how to add a banner and place it, how to reorder, how to hide and restore content, and how the storefront reacts (the `marvel_content_updated` event triggers a refresh).

- [ ] **Step 2: Run the final gate**

Run: `npm run check`
Expected: exit 0.

Run: `npm run test:e2e`
Expected: PASS.

Run: `npm run analyze:unused`
Expected: no unused file that this plan created. Report any pre-existing findings but do not fix unrelated ones.

- [ ] **Step 3: Verify the working tree state and the remote**

Run: `git status --short` → only the intended files.
Run: `git log --oneline -20` → 20 commits, one per task.
Run: `git remote -v` → confirm the remote exists but **do not push**. Verify with `git status -sb` that the branch is still ahead of its upstream and nothing was published.

- [ ] **Step 4: Write the SQL handoff note for the human partner**

Create `docs/sql/README.md` — the single place the human looks for what to run, in what order, and how to check it worked:

1. **Order matters.** `apply-01-content-taxonomy.sql` (DDL + the category tree + the products backfill) → deploy the Task 6 code → `apply-02-drop-site-categories.sql` (drops the old table) → `apply-03-run-seeds.md` (populates banners, footer and products).
2. For each bundle: what it does, what to paste where (Supabase SQL Editor), and its verification queries with expected results.
3. A short "how to roll back" section: what to restore to undo the migration, and the fact that `apply-02` is not reversible without a backup of the dropped `site_categories` rows.
4. A note that `supabase/schema.sql` was hand-maintained because no linked project was available, and should be regenerated with `supabase db dump` when one is.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/admin-content-guide.md docs/sql/README.md
git commit -m "docs: admin content guide and SQL handoff"
```

---

## Out-of-Scope Follow-ups (do not implement in this plan)

Record these in the final report; they are real and were found during analysis, but the user scoped them out.

1. Unauthenticated `POST/PUT/PATCH/DELETE /api/products` — `server/routes/products.js:111,169,196,223`.
2. Unauthenticated `GET/POST/PATCH /api/orders` and the IDOR where `role`/`userId` come from the query string — `server/routes/orders.js:17,44,83`.
3. Unauthenticated `GET /api/users` returning every profile — `server/routes/users.js:40`.
4. The unscoped `FOR ALL USING (true)` RLS policies on `products` and `orders` — `supabase/migrations/20260822000002_enhance_products_and_orders.sql:43-44,54-55`.
5. Privilege escalation via `profiles.role` — client-settable `user_metadata.role` (`20260822000004:35-37`) plus the unrestricted own-profile UPDATE policy (`20260822000000_init_schema.sql:89`).
6. `products.category` is still free text alongside `category_id` — the two can drift.
7. `supabase/schema.sql` drift is fixed for the new tables only; the historical migrations remain append-only.
8. `npm run format` across the repo (the known legacy Prettier baseline), and adding `prettier --check` + `knip` to CI.
9. The nine orphaned `server/test_*.js` scripts — they assert nothing and mutate real data.
10. The fake product data in `src/components/product/dynamicProductBuilder.js` and the stubbed checkout in `src/components/cart/CartPage.jsx`.
