# Admin Dashboard Charts — Design Spec

Date: 2026-10-16
Slice: Admin analytics (charts)
Scope: Add `recharts` charting library, build chart components from existing `reportUtils` data, wire into `UnifiedAdminConsole` dashboard Overview + Sales tabs.

Out of scope: New API endpoints (existing `GET /api/orders` + `GET /api/products` suffice), new admin tabs (reuse existing `dashboardView` states), export/print, real-time websocket charts.

## 1. Intent & Success Criteria

- Admin dashboard (Overview + Sales tabs) renders charts instead of only KPI cards + tables.
- Charts are driven by existing `reportUtils` aggregations (`lastNDayBuckets`, `salesWindows`, `revenueGrowth`, `summarizeStatuses`, `aggregateBestSellers`, `summarizeInventory`, `computeRepeatCustomers`) — no new backend code.
- Chart type variety: AreaChart, Vertical BarChart, PieChart, Horizontal BarChart, ComposedChart (bars + line), Doughnut — not just one chart type.
- Storefront/admin behavior unchanged except dashboard gets visual charts.
- Responsive: charts render correctly at 360 / 768 / 1280 viewports, no horizontal overflow.
- `prefers-reduced-motion` respected (chart animations disabled).
- Empty-data states render "No data" instead of blank or crash.
- `npm run check` (lint + test + build) green; Playwright dashboard checks pass; axe a11y no new violations.

## 2. Dependency

Add `recharts` (current stable) to `dependencies` in `package.json`. Recharts is React-native, declarative (`LineChart`, `BarChart`, `PieChart`, `ResponsiveContainer`, `ComposedChart`), small bundle, and maps 1:1 to `reportUtils` output shapes. No CSS framework changes — reuse existing `var(--navy)`, `--orange`, `--green` tokens.

## 3. Component Architecture

New directory: `src/components/admin/charts/`
Each component: pure, takes a single `data` prop (already-aggregated from `reportUtils`), handles empty/missing data, returns JSX only (no side effects).

| Component                | Data source                                             | Chart type                                                         | Empty-state            |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| `RevenueTrendChart`      | `chartData.points` from `lastNDayBuckets(orders, days)` | AreaChart (revenue, filled)                                        | "No sales data yet"    |
| `OrderStatusChart`       | `salesReport.statuses`                                  | Vertical BarChart (pending/processing/shipped/delivered/cancelled) | "No orders yet"        |
| `UserRolesChart`         | user role counts (from `users` state)                   | PieChart                                                           | "No users yet"         |
| `BestSellersChart`       | `salesReport.sellers` (top 5)                           | Horizontal BarChart                                                | "No products sold yet" |
| `OrdersPlusRevenueChart` | `lastNDayBuckets(orders, 30d)`                          | ComposedChart (bars = orders count, line = revenue)                | "No orders yet"        |
| `InventoryChart`         | `salesReport.inventory`                                 | Vertical BarChart (in stock / low stock / out of stock)            | "No products yet"      |
| `CustomerRepeatChart`    | `salesReport.repeat`                                    | Doughnut (repeat vs one-time)                                      | "No customers yet"     |
| `SalesGrowthCard`        | `salesReport.growth`                                    | Stat card (not a chart)                                            | "—"                    |

Styling: brand colors via CSS vars (`var(--navy)`, `--orange`, `--green`), `ResponsiveContainer`, animations disabled when `prefers-reduced-motion: reduce`.

## 4. Dashboard Integration (`UnifiedAdminConsole.jsx`)

- **Overview tab** (existing default): KPI cards (existing) + RevenueTrendChart (Area) + OrderStatusChart (Vertical Bar) + UserRolesChart (Pie) + BestSellersChart (Horizontal Bar) in a 2-column responsive grid.
- **Sales tab** (existing, currently empty): OrdersPlusRevenueChart (Composed, 30d) + InventoryChart (Vertical Bar) + CustomerRepeatChart (Doughnut) + SalesGrowthCard (stat).
- `timeRange` state (`7d` \| `30d`) already exists; RevenueTrendChart reads it.
- No changes to tab navigation or role gating (admin/super_admin only, existing).

## 5. Data Flow

`server/routes/orders.js` `GET /` → `orders` array → `reportUtils.lastNDayBuckets` / `salesWindows` / etc. → `UnifiedAdminConsole` memos (`chartData`, `salesReport`) → chart component props. No server changes.

## 6. Security / Perf / A11y

- Charts are client-side only; no new secrets, no new endpoints.
- `recharts` bundle (~40k gzipped) accepted; no code-splitting needed for a single dashboard.
- All charts: `<ResponsiveContainer>`, ARIA titles via `<Chart title>`, keyboard-navigable per recharts defaults, contrast kept on brand colors.
- Empty data → `null`/empty series → recharts renders empty chart; components guard with explicit "No data" text before rendering chart.

## 7. Verification

- `npm run lint` (oxlint) clean (no new warnings).
- `npm run test`: vitest passes (new chart component tests + existing reportUtils tests unaffected).
- `npm run build`: vite build green.
- Playwright: dashboard charts visible at 1280 / 768 / 360, no horizontal overflow (`scrollWidth <= innerWidth + 1`).
- `npm run a11y`: no new axe violations.

## 8. Rollout

1. `npm install recharts`
2. Create `src/components/admin/charts/` components + tests
3. Wire into `UnifiedAdminConsole.jsx` dashboard Overview + Sales tabs
4. `npm run check`, commit

## Self-review

- No TBD/TODO; requirements explicit.
- No contradictions: data layer already exists; charts only consume it.
- Single-slice scope; charts only, no new tabs/endpoints/exports.
- Ambiguity resolved: recharts chosen, Option A (Overview + Sales tabs) chosen, mixed chart types per screenshot review.
