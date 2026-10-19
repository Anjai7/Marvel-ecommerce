# Admin Dashboard Charts + Site Content UI — Design Spec

Date: 2026-10-17
Slices: Admin dashboard charts + Site Content menus UI (slice 2 of admin polish, following slice 1 dynamic menus + banners)
Stack: React 19, Vite 8, plain CSS + Tailwind-ish utility classes already in `src/index.css`, Radix UI + lucide-react (already deps), new dep: `recharts`, shadcn/ui patterns (DataTable, Dialog/Sheet, Progress, Badge, Tabs, Separator, Input, Select, Button) hand-rolled in `src/components/ui/` to match existing `lucide-react` + Radix usage.

Out of scope: New API endpoints (existing `GET /api/orders`, `/api/products`, `/api/menu` suffice), new admin tabs (reuse `dashboardView: overview | sales` and `activeTab: menus`), export/print, websocket real-time.

## 1. Intent & Success Criteria

Admin console should look and feel like a modern e-commerce operations platform (referenced screenshots):

**Dashboard (Overview + Sales tabs):**

- Gradient KPI stat cards: Today Orders / Yesterday Orders / This Month / Last Month
- Revenue & Sales Trends → AreaChart (filled area) from `lastNDayBuckets`
- Orders Pipeline → vertical BarChart rows per status from `summarizeStatuses`
- User Roles → PieChart from `users` role counts
- Best Selling Products → ranked list/table with images + revenue from `aggregateBestSellers`
- Orders + Revenue → ComposedChart (bars = orders count, line = revenue) from `lastNDayBuckets` 30d
- Inventory Snapshot → Progress bars (in stock / low stock / out of stock) from `summarizeInventory`
- Repeat Customers → Doughnut (repeat vs one-time) + top customer table from `computeRepeatCustomers`

**Site Content → Menus (UI overhaul):**

- Replace flat tree list with shadcn-style DataTable: Title, Path, Icon, Badge, Roles, Order, Active, Actions
- Add Top-Level Item button opening a shadcn Dialog sheet with form (title, path, icon select, badge, roles, order, active toggle)
- Inline edit via Dialog sheet (not inline text inputs)
- Search/filter, sort, row actions (edit/delete/reorder)
- Keep 3-level tree render option as a toggle within the same view

**Non-negotiables:**

- Empty states render "No data" instead of blank/crash
- `prefers-reduced-motion` respected (chart animations disabled)
- Responsive: 360 / 768 / 1280 viewports, no horizontal overflow
- `npm run check` (lint + test + build) green; Playwright dashboard + admin checks pass; axe a11y no new violations

## 2. Dependency

Add `recharts` (current stable) to `dependencies` in `package.json`. Recharts is React-native, declarative JSX, SVG-based, small bundle (~40k gzipped), and is the charting library used by shadcn/ui's chart wrapper. It maps 1:1 to `reportUtils` output shapes.

No CSS framework changes — reuse existing `src/index.css` tokens (`var(--navy)`, `--orange`, `--green`) and the existing `src/components/ui/` Radix wrappers (`Button`, `Input`, `Select`, `Dialog`, etc.) as the shadcn equivalents.

## 3. Component Architecture

New directory: `src/components/admin/charts/`
Each component: pure, takes a single `data` prop (already-aggregated from `reportUtils` or `useAuth` state), handles empty/missing data, returns JSX only.

| Component                | Data source                                             | Chart type                                                         | Empty-state            |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| `RevenueTrendChart`      | `chartData.points` from `lastNDayBuckets(orders, days)` | AreaChart (filled area)                                            | "No sales data yet"    |
| `OrderStatusChart`       | `salesReport.statuses`                                  | Vertical BarChart (pending/processing/shipped/delivered/cancelled) | "No orders yet"        |
| `UserRolesChart`         | user role counts from `users` state                     | PieChart                                                           | "No users yet"         |
| `BestSellersChart`       | `salesReport.sellers` (top 5)                           | Horizontal BarChart (image + title + revenue + qty)                | "No products sold yet" |
| `OrdersPlusRevenueChart` | `lastNDayBuckets(orders, 30d)`                          | ComposedChart (bars = orders count, line = revenue)                | "No orders yet"        |
| `InventoryChart`         | `salesReport.inventory`                                 | Vertical BarChart (in stock / low stock / out of stock)            | "No products yet"      |
| `CustomerRepeatChart`    | `salesReport.repeat`                                    | Doughnut (repeat vs one-time)                                      | "No customers yet"     |
| `SalesGrowthCard`        | `salesReport.growth`                                    | Stat card (not a chart)                                            | "—"                    |

Styling: brand colors via CSS vars (`--navy`, `--orange`, `--green`), `ResponsiveContainer`, animations disabled when `prefers-reduced-motion: reduce`.

## 4. Dashboard Integration (`UnifiedAdminConsole.jsx`)

**Overview tab** (existing default, replacing current static bars):

- Gradient stat cards row: Today Orders / Yesterday Orders / This Month / Last Month (from `salesWindows`)
- RevenueTrendChart (Area) + OrderStatusChart (Vertical Bar) + UserRolesChart (Pie) + BestSellersChart (Horizontal Bar) in 2-column responsive grid

**Sales tab** (existing, currently empty):

- OrdersPlusRevenueChart (Composed, 30d) + InventoryChart (Vertical Bar) + CustomerRepeatChart (Doughnut) + SalesGrowthCard (stat)

`timeRange` state (`7d` \| `30d`) already exists; RevenueTrendChart reads it. `salesReport` and `chartData` memos already exist in `UnifiedAdminConsole.jsx`.

No changes to tab navigation or role gating (admin/super_admin only, existing).

## 5. Site Content — Menus UI Redesign (`UnifiedAdminConsole.jsx` + new component)

Current: flat tree list with inline `HoverNav`-style rendering, inline edit via `ModalTreeEditor.jsx`.
New: `src/components/admin/MenuListEditor.jsx` (replaces/reworks `MenuTreeEditor.jsx`):

- Table header: Title | Path | Icon | Badge | Roles | Order | Active | Actions
- Rows: badge chip, path link, role chips, order input, active toggle, action buttons (edit / delete / reorder up-down)
- Top: search input, "Add Top-Level Item" button (blue primary) opening `ConfirmDialog`-style sheet (reuse `ConfirmDialog.jsx` or new `Dialog`-based form dialog)
- Edit row → open same form dialog pre-filled
- Delete → confirm dialog
- Reorder → drag handle or up/down buttons, persisted via `PATCH /api/menu/reorder` (already implemented in Task 2)
- Tree view toggle: "Show tree view" toggle button that renders the hierarchical indented list (current `normalizeToTree` + mega menu render logic reused)

The `MenuTreeEditor.jsx` is replaced by `MenuListEditor.jsx` (or refactored in place). The `ConfirmDialog` from Task 4 is reused for delete; a new `MenuItemForm` dialog (Radix `Dialog` + `Input`/`Select`) is used for add/edit.

## 6. Data Flow

**Charts:**

- `server/routes/orders.js` `GET /` → `orders` array → `reportUtils` aggregations → `UnifiedAdminConsole` memos (`chartData`, `salesReport`) → chart props.
- `server/routes/products.js` `GET /` → `products` array → `summarizeInventory` / `aggregateBestSellers` → chart props.
- `useAuth()` → `users` array → role counts → `UserRolesChart`.
- No server changes.

**Menus:**

- `server/routes/menu.js` `GET /api/menu?role=` → tree → `DynamicMenu` (storefront) + `MenuListEditor` (admin table).
- `POST /api/menu`, `PATCH /api/menu/reorder`, `DELETE /api/menu/:id` (already implemented + RBAC-guarded in Task 2).

## 7. Security / Perf / A11y

- Charts are client-side only; no new secrets, no new endpoints.
- `recharts` bundle (~40k gzipped) accepted.
- All charts: `<ResponsiveContainer>`, ARIA titles via `<Chart title>`, keyboard-navigable, contrast kept on brand colors.
- Empty data → explicit "No data" text.
- Admin tables: row selection, sort indicators, `aria-label` on action buttons, focus management on dialog open/close.

## 8. Verification

- `npm run lint` (oxlint) clean.
- `npm run test`: vitest passes (new chart + editor component tests + existing `reportUtils.test.js` unaffected).
- `npm run build`: vite build green.
- Playwright: dashboard charts visible at 1280 / 768 / 360, no horizontal overflow; admin menus table renders, add/edit/delete flows work.
- `npm run a11y`: no new axe violations.

## 9. Rollout

1. `npm install recharts`
2. Create `src/components/admin/charts/` components + tests
3. Create `src/components/admin/MenuListEditor.jsx` + test (replace/rework `MenuTreeEditor.jsx`)
4. Wire charts into `UnifiedAdminConsole.jsx` dashboard Overview + Sales tabs
5. Wire `MenuListEditor.jsx` into `UnifiedAdminConsole.jsx` site content > menus tab
6. `npm run check`, commit

## Self-review

- No TBD/TODO; requirements explicit.
- Data layer already exists (`reportUtils.js` + tested); charts only consume it.
- Single-slice scope; charts + menus UI only, no new tabs/endpoints/exports.
- Ambiguity resolved: recharts chosen; mixed chart types; Overview + Sales tabs; shadcn-style table for menus.
