# Dynamic Menus + Banners — Design Spec

Date: 2026-10-16
Slice: 1 of admin revamp (approved first)
Scope: 3-level dynamic menus (full mega-menu) + dynamic hero slides + site categories, editable from admin. Storefront renders dynamically with static fallback. Responsive + correct included for touched surfaces only.

Out of scope (later slices): charts library swap, header profile/settings/notifications, products 20/page + CRUD confirms, orders/billing/Excel-CSV, sidebar color, full-site responsive audit.

## 1. Intent & Success Criteria

- Admin (admin/super_admin) can create/edit/delete/reorder menu > sub-menu > sub-sub-menu without code deploys.
- Mega-menu supports per the screenshot: section columns (MOBILES, COMPUTERS, AUDIO, CAMERAS, ACCESSORIES, GAMING) with icons, item badges (HOT/POPULAR/NEW/DEALS), and optional promo card.
- Admin can manage hero carousel slides (bg image, product/single image, badge, title, subtitle, button text/link, price pill, tag, order, active) and category circles (name, image, link, order, active).
- Storefront `DynamicMenu`, `HeroBanner`, `CategorySlider` load live data; if API/DB empty or fails, fall back to current `src/data.js` (`megaMenuData`, `heroSlides`, `categorySliderItems`) so site never blanks.
- RBAC enforced server-side; public read, admin write.
- Responsive: 360 / 768 / 1280 verified; no horizontal overflow; `prefers-reduced-motion` honored.
- Tests: `npm run check` green, targeted Playwright viewport checks, axe no new violations.

## 2. Data Model (Supabase migrations)

New migration `20261016000006_dynamic_menus_banners.sql`. Additive only, no breaking changes to existing `menu_items`.

### 2.1 `menu_items` — reuse + extend

Existing columns (from `supabase/schema.sql`): `id UUID PK`, `title`, `path`, `icon DEFAULT 'Layers'`, `parent_id FK menu_items(id) ON DELETE CASCADE`, `roles_allowed TEXT[]`, `order_index INT DEFAULT 0`, `badge TEXT`, `is_active BOOLEAN DEFAULT true`, `created_at`.

Add:

- `level INT DEFAULT 1 CHECK (level BETWEEN 1 AND 3)` — 1=menu, 2=sub, 3=sub-sub.
- `section TEXT` — mega-menu column header (e.g. `MOBILES`); null for plain links.
- `section_icon TEXT` — emoji/lucide key for column header.
- `badge_variant TEXT DEFAULT 'accent' CHECK (badge_variant IN ('accent','secondary','success','neutral'))` — maps HOT/POPULAR/NEW/DEALS styling.
- `promo_title TEXT`, `promo_subtitle TEXT`, `promo_image_url TEXT`, `promo_cta_text TEXT`, `promo_cta_path TEXT` — only used on level-1 items that show a featured/promo card; null otherwise.
- Index: `(parent_id, order_index)`, `(is_active, order_index)`.
- Constraint: `parent_id IS NULL` when `level=1`; `parent_id NOT NULL` when `level>1`. Enforced in app + trigger, not strict FK check to allow seed ordering.

RLS: keep existing policies; add `FOR SELECT USING (is_active = true)` already present. Write path uses service-role key server-side (existing `server/db.js` pattern), so no anon write.

Seed: migrate current static `megaMenuData` Electronics/Fashion/etc. into rows (script in migration or seed file, not hardcoded in app).

### 2.2 `hero_slides` (new)

- `id UUID PK DEFAULT gen_random_uuid()`
- `badge TEXT`, `title TEXT NOT NULL`, `subtitle TEXT`
- `btn_text TEXT`, `btn_path TEXT DEFAULT '/products'`
- `bg_image_url TEXT`, `product_image_url TEXT`, `fallback_image_url TEXT`
- `bg_gradient TEXT` — e.g. `linear-gradient(135deg, #091322 0%, #172a45 100%)`
- `price_text TEXT`, `tag TEXT`, `ribbon_text TEXT`
- `order_index INT DEFAULT 0`, `is_active BOOLEAN DEFAULT true`
- `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`
- RLS: public `SELECT WHERE is_active=true`; write via service role.
- Seed: copy 3 entries from `src/data.js heroSlides` (Unsplash URLs kept as initial data; admin can replace with Cloudinary URLs).

### 2.3 `site_categories` (new)

- `id UUID PK DEFAULT gen_random_uuid()`
- `name TEXT NOT NULL`, `image_url TEXT NOT NULL`, `path TEXT DEFAULT '/products'`
- `order_index INT DEFAULT 0`, `is_active BOOLEAN DEFAULT true`
- `created_at TIMESTAMPTZ DEFAULT now()`
- RLS same pattern as above.
- Seed: copy 10 entries from `categorySliderItems`.

## 3. API (Express, `server/routes/`)

Conventions: keep existing `/api` prefix, `verifyToken` + `requireRole(['admin','super_admin'])` for writes (fixes current open-write gap in `menu.js:49,86`). Public `GET` stays open with `is_active` filter + role filter.

### 3.1 Menus — extend `server/routes/menu.js`

- `GET /api/menu?role=user` → returns tree, not flat list:
  ```json
  [{ "id": "...", "title": "Electronics", "path": "/category/electronics", "icon": "Cpu", "badge": "HOT", "level": 1, "order_index": 2, "children": [{ "id": "...", "title": "Mobiles", "section": "MOBILES", "level": 2, "children": [...] }] }]
  ```
  Build tree server-side from flat Supabase rows (single query `eq is_active true order order_index`, then nest by `parent_id`). Filter by `roles_allowed` includes `role` or `role==='super_admin'`. Keep backward compat: `?flat=1` returns flat list for old clients during rollout.
- `POST /api/menu` (admin): accept full item incl. `parent_id, level, section, section_icon, badge, badge_variant, roles_allowed, order_index, is_active, promo_*`. Validate: `title+path` required; if `level>1` require `parent_id` and parent `level = level-1`; max depth 3. `upsert` to Supabase, return updated tree. Broadcast hint via existing `marvel_menu_updated` event (frontend already listens in `DynamicMenu.jsx:59`).
- `PATCH /api/menu/reorder` (admin, new): body `{ orders: [{id, order_index, parent_id}] }` for drag-reorder; single transaction/loop.
- `DELETE /api/menu/:id` (admin): delete; children cascade via FK. Return tree.
- Errors: 400 validation, 401 no token, 403 wrong role, 500 with `{error}` (existing pattern).

### 3.2 Banners + categories (new `server/routes/content.js`, mounted as `/api/content`)

- `GET /api/content/hero` → `{ slides: [...] }` ordered, `is_active` only. No auth.
- `GET /api/content/categories` → `{ categories: [...] }`. No auth.
- `POST /api/content/hero` (admin): create/update slide. Validate `title` required; URLs must be https or Cloudinary IDs; `order_index` int.
- `DELETE /api/content/hero/:id` (admin).
- `POST /api/content/categories`, `DELETE /api/content/categories/:id` — same guards.
- Image upload reuses `POST /api/upload` (multer → Cloudinary `services/cloudinary.js`); admin pastes returned `signed_url` into slide/category form. No new upload path.

`server/app.js`: mount `contentRoutes`; keep `api/index.js` re-export for Vercel.

## 4. Admin UI (in `SuperAdminDashboard` / `AdminPortal` → new tabs)

No new framework. Plain JSX + existing `ui/` (`Button`, `Input`, `Dialog`), `lucide-react` icons. New files to avoid bloating `UnifiedAdminConsole.jsx` (already ~1400 lines):

- `src/components/admin/MenuTreeEditor.jsx` — 3-level tree list, expand/collapse, inline active toggle, up/down reorder + drag later, Add sub/sub-sub buttons, Edit opens `MenuItemForm`, Delete opens confirm `Dialog`.
- `src/components/admin/HeroSlidesEditor.jsx` — table/cards of slides with preview thumb, order, active toggle, Edit opens form with live preview, Delete confirm.
- `src/components/admin/CategoriesEditor.jsx` — same pattern, smaller fields.
- Shared `src/components/admin/ConfirmDialog.jsx` — generic "Delete X? This cannot be undone." with Cancel/Delete, used for all three (satisfies "edit and delete in view with confirmation" for this slice; products/orders confirms come in their slices).
- `src/api/backendApi.js`: add `apiFetchMenuTree(role)`, `apiSaveMenuItem`, `apiDeleteMenuItem` (tree-aware, keep old names as wrappers), `apiFetchHeroSlides`, `apiSaveHeroSlide`, `apiDeleteHeroSlide`, `apiFetchSiteCategories`, `apiSaveSiteCategory`, `apiDeleteSiteCategory`. Keep `getAuthHeaders()` pattern; no token logging.

Validation UX: required-field hints, disabled Save while saving, `useToast` success/error, refresh list + `window.dispatchEvent(new Event('marvel_menu_updated'))` after menu save.

Placement: new "Site Content" section in sidebar (above Users) with sub-items Menus / Hero Banners / Categories. Only `admin`+`super_admin` see it (existing `expandedMenus` pattern in `UnifiedAdminConsole.jsx:97`).

## 5. Storefront Rendering + Fallback

- `src/components/navigation/DynamicMenu.jsx`: fetch tree (`apiFetchMenuTree`); render hover mega-menu: level-1 bar items; on hover show columns grouped by `section` (level-2 as column headers, level-3 as links) + promo card if `promo_title` set. Keep current `align-right` logic for second-half items (`index.css:560`), `max-width: min(1040px, calc(100vw - 32px))`, keyboard focus support. If fetch empty/fails, fall back to static `megaMenuData` grouped render (existing `HoverNav` path untouched as safety).
- `src/components/HeroBanner.jsx`: try `apiFetchHeroSlides()` first; if non-empty use live slides, else `heroSlides` static. Same autoplay 4500ms, pause on hover/touch, dots, `prefers-reduced-motion` (keep current logic `HeroBanner.jsx:8-28`). Images: `loading eager` first, `lazy` rest; `onError` fallback preserved.
- `src/components/CategorySlider.jsx`: same fetch-with-fallback pattern for `site_categories`.
- `ICON_MAP` extended to allow stored `icon` keys; unknown icons → `Layers` (current fallback).
- CSS: reuse `index.css` mega-menu/hero/category styles; add only missing responsive guards in same file (per approved Section 4 of prior responsive discussion, scoped to touched surfaces):
  - `.mega-menu { flex-direction: column on <1100px }` already exists — verify + ensure promo column stacks.
  - Hero inner grid `1.2fr 1fr` → `1fr` under 900px, hide `.hero-png-showcase` under 600px if text overflows (already partially at `index.css:2894`).
  - No global reflow; no new CSS framework.

## 6. Security, Perf, A11y

- Writes require `verifyToken+requireRole`; `POST /signup` public-role block stays (`auth.js:85-89`).
- No service-role key to client; uploads via backend only.
- Lists paginated in admin (client-side 20/page for this slice; server pagination later with products/orders slice).
- Images: Cloudinary `quality auto, fetch_format auto` (existing service); `max-width:100%`.
- A11y: buttons have `aria-label`, dialogs trap focus (Radix `Dialog`), dots have `aria-current`, touch targets ≥40px, contrast kept.

## 7. Verification

- `npm run lint && npm run test && npm run build` (`npm run check`).
- New Vitest: tree-builder unit (`buildMenuTree` pure fn), fallback tests (empty API → static data renders), form validation.
- Playwright (targeted, per AGENTS.md): admin login → edit menu/banner/category → storefront reflects at 1280/768/360; screenshots on failure retained. `npx playwright test tests/storefront.spec.js` + new `tests/site-content.spec.js`.
- Real Chrome check at 360/768/1280 for hover nav, hero, categories; axe `npm run a11y` no new violations.
- `npm run audit` (high/critical gate).

## 8. Rollout

1. Migration + seeds applied (`supabase db push`, `db:push` script).
2. Backend `menu.js` tree + `content.js` merged, Vercel `/api/*` still routes via `api/index.js`.
3. Frontend editors behind admin role; storefront dual-read (live → fallback) so rollback = set rows inactive.
4. No env changes; no `.env` commits.

## 9. Self-review

- No TBD/TODO; requirements explicit; architecture matches existing Express+Supabase+plain-CSS patterns.
- No contradictions: public read open, writes guarded; fallback prevents blank pages.
- Single-slice scope; products/orders/billing/charts/header/sidebar-color explicitly deferred.
- Ambiguity resolved: full mega fields chosen (Q1), hero+categories chosen (Q2), approach A chosen (approved).
