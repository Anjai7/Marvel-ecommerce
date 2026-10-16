# Dynamic Menus + Banners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make menus (3-level mega-menu), hero slides, and category circles dynamically manageable from admin with live storefront rendering and static fallback.

**Architecture:** Additive Supabase migration + tree-building Express routes with admin-guarded writes + new admin editor components + fetch-with-fallback storefront rendering. No framework migration; plain CSS in `src/index.css`.

**Tech Stack:** React 19 JSX, Express 4, Supabase Postgres + RLS, Cloudinary (existing upload), Vitest + happy-dom, Playwright + axe-core.

**Spec:** `Marvel-ecommerce/docs/superpowers/specs/2026-10-16-dynamic-menus-banners-design.md`

## Global Constraints

- Node >=22.12, npm >=10; use project-local npm scripts, never assume global CLIs.
- Keep changes focused; do not reformat unrelated files or migrate frameworks.
- Preserve `.env` files; never print, commit, or copy secrets into logs or docs.
- Do not edit `dist/`; it is generated output.
- Writes require `verifyToken` + `requireRole(['admin','super_admin'])`; public `GET` filters `is_active=true`.
- Storefront must never blank: live data first, static `src/data.js` fallback second.
- For UI work, verify viewports 360 / 768 / 1280 in real browser + targeted Playwright; `npm run check` before finishing.
- Add/update tests for behavior changes; keep unit tests fast, Playwright for browser flows.

## Review Focus

- Empty DB / API failure still renders static mega-menu, hero, categories without blank sections or console throw.
- Depth-3 nesting with missing parent or circular `parent_id` cannot crash tree builder or produce infinite loop.
- Non-admin token calling `POST/DELETE /api/menu` or `/api/content/*` gets 401/403, never writes.
- Oversized Cloudinary/Unsplash image URLs and long titles do not cause horizontal overflow at 360px.
- Rapid reorder/save clicks do not duplicate rows or leave stale `marvel_menu_updated` listeners.

---

### Task 1: DB migration + seeds

**Files:**

- Create: `Marvel-ecommerce/supabase/migrations/20261016000006_dynamic_menus_banners.sql`
- Test: `Marvel-ecommerce/src/components/admin/menuTree.test.js` (pure builder tested in Task 4; here verify SQL applies via `supabase db push --dry-run` or local lint)

**Interfaces:**

- Consumes: existing `menu_items` table (`supabase/schema.sql`).
- Produces: `menu_items.level/section/section_icon/badge_variant/promo_*` columns + `hero_slides` + `site_categories` tables + seeds from `src/data.js`.

- [ ] **Step 1: Write migration SQL with new columns, two new tables, indexes, RLS, and seeds copied from `src/data.js` (megaMenuData sections, 3 heroSlides, 10 categorySliderItems).**
- [ ] **Step 2: Validate SQL parses and lists no destructive `DROP`**

Run: `npx supabase db lint --local` (or `supabase migration list` if CLI available)
Expected: PASS / no errors; if CLI unauthenticated, paste `psql --dry-run` parse check output in commit message.

- [ ] **Step 3: Commit**

```bash
git add Marvel-ecommerce/supabase/migrations/20261016000006_dynamic_menus_banners.sql
git commit -m "feat(db): dynamic menus 3-level + hero + categories"
```

### Task 2: Menu API tree + RBAC fix

**Files:**

- Modify: `Marvel-ecommerce/server/routes/menu.js:17-97`
- Create: `Marvel-ecommerce/server/routes/menuTree.js` (pure `buildMenuTree(rows) -> tree`, no express dependency, imported by `menu.js`)
- Test: `Marvel-ecommerce/server/routes/menuTree.test.js` (vitest; run via `npm run test`)

**Interfaces:**

- Consumes: `supabase` client from `server/db.js`, `verifyToken, requireRole` from `server/middleware/auth.js`.
- Produces: `buildMenuTree(rows: Row[]) -> Node[]`; `GET /api/menu?role=&flat=`; `POST /api/menu`; `PATCH /api/menu/reorder`; `DELETE /api/menu/:id`.

- [ ] **Step 1: Write failing test for tree nesting, role filter, and depth-3 cap**

```js
import { describe, it, expect } from "vitest";
import { buildMenuTree } from "./menuTree.js";
describe("buildMenuTree", () => {
  it("nests level 2+3 under level 1 and filters inactive", () => {
    const rows = [
      {
        id: "1",
        title: "Electronics",
        path: "/e",
        level: 1,
        order_index: 1,
        is_active: true,
        roles_allowed: ["user"],
      },
      {
        id: "2",
        title: "Mobiles",
        path: "/e/m",
        level: 2,
        parent_id: "1",
        section: "MOBILES",
        order_index: 1,
        is_active: true,
      },
      {
        id: "3",
        title: "Smartphones",
        path: "/e/m/s",
        level: 3,
        parent_id: "2",
        order_index: 1,
        is_active: true,
      },
      { id: "4", title: "Hidden", path: "/x", level: 1, order_index: 2, is_active: false },
    ];
    const tree = buildMenuTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].title).toBe("Smartphones");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- server/routes/menuTree.test.js`
Expected: FAIL with "buildMenuTree not defined / Cannot find module".

- [ ] **Step 3: Implement `buildMenuTree(rows)` in `server/routes/menuTree.js` — single-pass map by id, attach to parent, sort by `order_index`, drop inactive, guard circular refs (visited set, max depth 3).**
- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- server/routes/menuTree.test.js`
Expected: PASS.

- [ ] **Step 5: Guard `POST /`, `PATCH /reorder`, `DELETE /:id` in `server/routes/menu.js` with `verifyToken, requireRole(['admin','super_admin'])`; add validation (title+path required, level>1 requires parent_id, reject level>3); implement `GET` tree assembly + `?flat=1` compat + role filter incl. `super_admin` sees all.**
- [ ] **Step 6: Smoke-test routes with supertest or curl against `node server/index.js` (GET tree shape, POST without token → 401)**

Run: `npm run test -- server/routes/menuTree.test.js && node -e "import('./Marvel-ecommerce/server/app.js').then(m=>console.log(Object.keys(m.default._router.stack.map(()=>1))))"`
Expected: unit PASS; app imports without throw.

- [ ] **Step 7: Commit**

```bash
git add Marvel-ecommerce/server/routes/menu.js Marvel-ecommerce/server/routes/menuTree.js Marvel-ecommerce/server/routes/menuTree.test.js
git commit -m "feat(api): menu tree + admin-guarded writes"
```

### Task 3: Content API (hero + categories) + frontend client

**Files:**

- Create: `Marvel-ecommerce/server/routes/content.js`
- Modify: `Marvel-ecommerce/server/app.js:5-38` (mount `/api/content`)
- Modify: `Marvel-ecommerce/src/api/backendApi.js:126-159` (append new client fns, keep `getAuthHeaders` pattern)
- Test: `Marvel-ecommerce/src/api/contentApi.test.js`

**Interfaces:**

- Consumes: `supabase` (`server/db.js`), `verifyToken/requireRole`, existing `POST /api/upload` for image URLs.
- Produces: `GET /api/content/hero`, `POST /api/content/hero`, `DELETE /api/content/hero/:id`, `GET /api/content/categories`, `POST /api/content/categories`, `DELETE /api/content/categories/:id`; client `apiFetchHeroSlides()`, `apiSaveHeroSlide(d)`, `apiDeleteHeroSlide(id)`, `apiFetchSiteCategories()`, `apiSaveSiteCategory(d)`, `apiDeleteSiteCategory(id)`.

- [ ] **Step 1: Write failing client test (fallback on fetch failure returns `[]`, save without token throws)**

```js
import { describe, it, expect, vi } from "vitest";
import { apiFetchHeroSlides } from "./backendApi.js";
describe("content api client", () => {
  it("returns [] on network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("down")));
    const res = await apiFetchHeroSlides();
    expect(res).toEqual([]);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/api/contentApi.test.js`
Expected: FAIL with "apiFetchHeroSlides is not a function".

- [ ] **Step 3: Implement `server/routes/content.js` (ordered `is_active` reads open; writes admin-guarded with https-URL + required-field validation) and mount in `server/app.js`.**
- [ ] **Step 4: Implement client fns in `src/api/backendApi.js` with same try/catch-returns-`[]` pattern as `apiFetchMenuItems`.**
- [ ] **Step 5: Run tests**

Run: `npm run test -- src/api/contentApi.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Marvel-ecommerce/server/routes/content.js Marvel-ecommerce/server/app.js Marvel-ecommerce/src/api/backendApi.js Marvel-ecommerce/src/api/contentApi.test.js
git commit -m "feat(api): hero + categories content endpoints + client"
```

### Task 4: Admin menu tree editor + confirm dialog

**Files:**

- Create: `Marvel-ecommerce/src/components/admin/ConfirmDialog.jsx`
- Create: `Marvel-ecommerce/src/components/admin/MenuTreeEditor.jsx`
- Modify: `Marvel-ecommerce/src/components/admin/UnifiedAdminConsole.jsx:96-102,1240-1371` (add "Site Content > Menus" tab wiring, reuse modal styles `modal-backdrop-overlay/modal-content-container`)
- Test: `Marvel-ecommerce/src/components/admin/MenuTreeEditor.test.jsx`

**Interfaces:**

- Consumes: `apiFetchMenuItems/apiSaveMenuItem/apiDeleteMenuItem` (tree-aware), `useToast`, existing modal CSS.
- Produces: `<ConfirmDialog open title message onCancel onConfirm />`, `<MenuTreeEditor role />`.

- [ ] **Step 1: Write failing test (renders tree levels, delete asks confirm, confirm calls delete)**

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog.jsx";
describe("ConfirmDialog", () => {
  it("calls onConfirm only after explicit click", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete menu?"
        message="Cannot be undone."
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/admin/MenuTreeEditor.test.jsx`
Expected: FAIL with "Cannot find module ./ConfirmDialog.jsx".

- [ ] **Step 3: Implement `ConfirmDialog.jsx` (Radix `Dialog` or existing modal classes, Cancel/Delete, `aria-label`, focus on Delete) and `MenuTreeEditor.jsx` (fetch tree, expand/collapse, active toggle, up/down reorder calling `PATCH /menu/reorder`, Add sub/sub-sub, Edit form with title/path/icon/badge/badge_variant/roles/order/section/promo fields, Delete via ConfirmDialog, toast + `marvel_menu_updated` dispatch).**
- [ ] **Step 4: Wire "Site Content > Menus" tab in `UnifiedAdminConsole.jsx` (admin/super_admin only).**
- [ ] **Step 5: Run tests**

Run: `npm run test -- src/components/admin/MenuTreeEditor.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Marvel-ecommerce/src/components/admin/ConfirmDialog.jsx Marvel-ecommerce/src/components/admin/MenuTreeEditor.jsx Marvel-ecommerce/src/components/admin/MenuTreeEditor.test.jsx Marvel-ecommerce/src/components/admin/UnifiedAdminConsole.jsx
git commit -m "feat(admin): menu tree editor + delete confirm"
```

### Task 5: Admin hero + categories editors

**Files:**

- Create: `Marvel-ecommerce/src/components/admin/HeroSlidesEditor.jsx`
- Create: `Marvel-ecommerce/src/components/admin/CategoriesEditor.jsx`
- Modify: `Marvel-ecommerce/src/components/admin/UnifiedAdminConsole.jsx` (add Hero/Categories sub-tabs)
- Test: `Marvel-ecommerce/src/components/admin/HeroSlidesEditor.test.jsx`

**Interfaces:**

- Consumes: `ConfirmDialog`, content client fns from Task 3, existing `POST /api/upload` flow (paste `signed_url`).
- Produces: `<HeroSlidesEditor />`, `<CategoriesEditor />`.

- [ ] **Step 1: Write failing test (slide form requires title, invalid URL blocked, delete needs confirm)**

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HeroSlidesEditor from "./HeroSlidesEditor.jsx";
describe("HeroSlidesEditor", () => {
  it("renders slides list with edit and delete actions", async () => {
    render(<HeroSlidesEditor />);
    expect(await screen.findByText(/hero slides/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/admin/HeroSlidesEditor.test.jsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement both editors (table/cards + preview thumb, order/active, form fields per spec §2.2/2.3 with live preview, image URL from upload response, Delete via ConfirmDialog, toasts).**
- [ ] **Step 4: Run tests**

Run: `npm run test -- src/components/admin/HeroSlidesEditor.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Marvel-ecommerce/src/components/admin/HeroSlidesEditor.jsx Marvel-ecommerce/src/components/admin/CategoriesEditor.jsx Marvel-ecommerce/src/components/admin/HeroSlidesEditor.test.jsx Marvel-ecommerce/src/components/admin/UnifiedAdminConsole.jsx
git commit -m "feat(admin): hero + categories editors with confirms"
```

### Task 6: Storefront dynamic render + responsive guards + verification

**Files:**

- Modify: `Marvel-ecommerce/src/components/navigation/DynamicMenu.jsx:38-126`
- Modify: `Marvel-ecommerce/src/components/HeroBanner.jsx:6-115`
- Modify: `Marvel-ecommerce/src/components/CategorySlider.jsx:6-70`
- Modify: `Marvel-ecommerce/src/index.css` (append scoped responsive guards only, no reformat)
- Create: `Marvel-ecommerce/tests/site-content.spec.js`

**Interfaces:**

- Consumes: Task 2–3 client fns + static `src/data.js` (`megaMenuData`, `heroSlides`, `categorySliderItems`).
- Produces: live-first/fallback-second rendering; Playwright viewport coverage.

- [ ] **Step 1: Write failing Playwright spec (admin seeds one menu + hero, storefront shows them at 1280; 360 has no horizontal overflow)**

```js
import { test, expect } from "@playwright/test";
test("dynamic hero renders with fallback", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-carousel")).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
});
```

- [ ] **Step 2: Run spec to verify baseline (may pass on fallback; confirms harness works)**

Run: `npx playwright test tests/site-content.spec.js --project=chromium`
Expected: PASS on fallback OR FAIL showing missing live hooks (either is informative pre-implementation).

- [ ] **Step 3: Implement fetch-with-fallback in all three components (live fetch in `useEffect`, `marvel_menu_updated` listener for menus, `loading` placeholder, `ICON_MAP` fallback to `Layers`, hero keeps autoplay/pause/dots/`onError` fallback, categories keep scroll buttons).**
- [ ] **Step 4: Add scoped CSS guards (mega-menu column stack <1100px already present — verify; hero grid `1fr` <900px + hide `.hero-png-showcase` <600px only if overflow; `.mega-menu,.hero-slide-inner-grid,.cat-slider{min-width:0;overflow-x:clip}`; touch targets ≥40px).**
- [ ] **Step 5: Run full verification**

Run: `npm run lint && npm run test && npm run build`
Expected: all PASS + `dist/` built.
Run: `npx playwright test tests/site-content.spec.js tests/storefront.spec.js --project=chromium`
Expected: PASS at 1280; rerun with `--project=chromium --viewport` matrix or manual 360/768 checks + `npm run a11y` no new violations.

- [ ] **Step 6: Commit**

```bash
git add Marvel-ecommerce/src/components/navigation/DynamicMenu.jsx Marvel-ecommerce/src/components/HeroBanner.jsx Marvel-ecommerce/src/components/CategorySlider.jsx Marvel-ecommerce/src/index.css Marvel-ecommerce/tests/site-content.spec.js
git commit -m "feat(storefront): dynamic menus+banners with fallback + responsive guards"
```
