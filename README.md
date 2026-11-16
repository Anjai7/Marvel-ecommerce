# 🛒 Marvel — E-Commerce Marketplace

A tech marketplace with a storefront and an admin console: a product catalogue with
categories, variants, offers and reviews; a customer portal with orders and a wishlist;
a vendor dashboard; and a console where every word, banner, menu and category on the
storefront is edited as data rather than as code.

- **Frontend** — React 19, Vite, plain CSS (no Tailwind), Radix UI, Material UI for
  switches, Lucide icons, Recharts for the console charts.
- **Backend** — Express, Supabase (Postgres + Auth + Storage), Cloudinary for images.
- **Quality** — Oxlint, Prettier, Vitest, Testing Library, Playwright, axe-core, Knip
  and Lefthook.

---

## Getting started

Node.js **22.12+** and npm **10+** are required (`.nvmrc` pins the version).

```bash
npm install
npm run dev:all      # the API on :5000 and Vite on :5173, together
```

Open <http://localhost:5173>. `npm run dev` runs the frontend alone.

### Commands

| Command                  | What it does                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| `npm run dev:all`        | the API and the frontend together                                     |
| `npm run check`          | lint, the inline-style guard, the unit tests and the production build |
| `npm run test:e2e`       | the Playwright browser and accessibility checks                       |
| `npm run a11y`           | the accessibility checks on their own                                 |
| `npm run build`          | the production bundle in `dist/`                                      |
| `npm run build:analyze`  | `dist/bundle-report.html`, a bundle breakdown                         |
| `npm run analyze:unused` | dead files, exports and dependencies (Knip)                           |
| `npm run audit`          | fails on a high or critical npm vulnerability                         |
| `npm run format`         | Prettier over the project                                             |
| `npm run db:apply`       | applies the outstanding database migrations (needs a DDL credential)  |
| `npm run seed:content`   | the content, the catalogue and the filler seeds                       |

### The seeded accounts

| Role        | Email                   | Password        |
| ----------- | ----------------------- | --------------- |
| Admin       | `admin@marvel.com`      | `admin123`      |
| Super admin | `superadmin@marvel.com` | `superadmin123` |
| Vendor      | `vendor@marvel.com`     | `vendor123`     |
| Customer    | `user@marvel.com`       | `user123`       |

### Environment

`JWT_SECRET` must be **at least 32 characters** — the API refuses to boot in
production with a shorter one. `SUPABASE_SERVICE_ROLE_KEY` is required by the seed
scripts. `ALLOWED_ORIGINS` is a comma-separated CORS allowlist that defaults to the two
localhost dev origins. `.env.example` lists everything.

---

## How the project is laid out

```
src/
  api/          the client for every endpoint (one module per area)
  components/   the React components, by area
    admin/      the console: its editors, its panels, its forms
    auth/       sign in and sign up
    cart/       the cart page
    category/   the category listing and the category page
    customer/   the customer portal
    product/    the product page, the gallery, the tabs, the reviews
    storefront/ the home page's widgets
    ui/         the shared primitives every screen uses
    vendor/     the vendor dashboard
  context/      auth, cart and content state
  lib/          the route table, the currency helpers, the option kinds
  sections/     the CMS section blocks a page is assembled from
  styles/       every stylesheet in the app (see below)
  App.jsx       the router and the shell
  main.jsx      the entry point
server/
  routes/       one module per endpoint group
  services/     Cloudinary and the other outside services
  lib/          the server-side rules (page rules, option kinds)
  app.js        the Express app
docs/           the documentation index is in docs/README.md
```

### The styles

**Every rule in the app lives in `src/styles/`.** There are no inline styles and no
stylesheets next to the components: `src/main.jsx` imports `src/styles/index.css`, and
that file imports every sheet in the order the cascade expects. The order is written
down there instead of happening by accident of the import graph.

```
src/styles/
  index.css      the entry point — the only stylesheet the app loads
  base/          tokens.css (the design tokens), shell.css, primitives.css,
                 responsive.css, motion.css
  storefront/    home.css, footer.css, product-page.css, chrome.css, layout.css,
                 mobile-menu.css, widgets.css, product-surfaces.css, auth.css,
                 cart.css, sections.css, dynamic.css
  admin/         console.css, console-area.css, content.css, editors.css, forms.css,
                 panels.css, inline-panel.css, tree.css, reports.css,
                 banners-editor.css, variants-editor.css, charts.css
  portals/       customer-portal.css, vendor-dashboard.css
  ui/            primitives.css, table.css
```

A sheet never imports another sheet. To add a rule, put it in the sheet for the area it
belongs to — the guide is **[docs/frontend-guide.md](docs/frontend-guide.md)**.

---

## The rules that keep it consistent

**1. No inline styles.** A `style={{…}}` cannot be found with a search and cannot be
themed, so every style is a named class in the area's stylesheet and uses the tokens in
`src/styles/base/tokens.css`. `npm run lint:styles` fails the build if an inline style
appears anywhere in `src/` — the four that remain are one-off geometry (a column count,
a spacer height) and say so on the line.

**2. One table structure.** Every table in the app is built from the `Table` parts in
`src/components/ui/Table.jsx`, so they look the same and can be restyled in one place.
A table becomes a stack of cards when the column it sits in is too narrow for it — the
container query in `src/styles/ui/table.css` decides, not the width of the window,
because the console keeps a 280px sidebar. Give every cell that is not the headline or
the action column a `data-label` so the card keeps its column name.

**3. One search field.** Every list filters through `SearchInput`.

**4. One switch.** Every on/off control is the Material UI `Switch` in
`src/components/ui/Switch.jsx`.

**5. Tokens, not literals.** Colours, radii, shadows and spacing come from the
`:root` block in `src/styles/base/tokens.css`. A new colour is a new token.

**6. Nothing overflows.** At every width the document must not scroll sideways, and
every control must be reachable by a thumb — 44×44px on a coarse pointer.

---

## The features

### Storefront

- A homepage built from data: the hero carousel, the category slider, the promo
  banners, the trending and featured carousels and the section blocks.
- A category tree of three levels, where a category's URL is its whole ancestor path.
- A product page with a sticky gallery, a magnifier zoom, a lightbox, the offers and
  EMI cards, the specifications, the reviews and the rating breakdown.
- **Product options and variants** — a product may carry colour, size, capacity,
  storage, material, style, weight or flavour. The customer picks, the price and stock
  follow the combination, and the cart, the order, the customer's order list and the
  vendor's order list all show what was chosen. See
  **[docs/product-variants-contract.md](docs/product-variants-contract.md)**.
- A cart, a wishlist, the customer portal with its orders and tracking, and the vendor
  dashboard with its catalogue, its orders and its shipments.
- Marketing, policy and category landing pages at `#/pages/<slug>`, assembled from an
  ordered stack of twelve section types, published with no redeploy.

### Admin console

- **Dashboard** — the store at a glance: what needs shipping, what is running out, the
  revenue and order trends, the role split and the live order feed.
- **Orders, products, customers and users** — each a searchable, filterable table.
- **Site content** — the navigation tree, the hero slides, the category tree, the promo
  banners and the footer, each edited in the page rather than in a popup.
- **Settings** — the store's own configuration.

Every editor writes straight to the database: what an admin saves is what the
storefront shows, with no rebuild in between.

---

## The database

The schema is applied by SQL that **you** run — the bundles, their order and their
verification queries are in **[docs/sql/README.md](docs/sql/README.md)**:

```
docs/sql/apply-01-content-taxonomy.sql      the tables and the category seed
docs/sql/apply-02-drop-site-categories.sql  drops the old table, after the code ships
docs/sql/apply-03-run-seeds.md              populates banners, footer and products
docs/sql/apply-04-product-variants.sql      options, the shared catalogue, the variants
```

The seeds are also npm scripts, are safe to re-run (they upsert by deterministic id and
never delete anything), and cover the whole taxonomy:

```bash
npm run seed:content     # banners, footer sections and links
npm run seed:products    # a catalogue across the whole taxonomy
```

The contract between the server and the storefront — every table, every column and
every API shape — is **[docs/backend-owned-content.md](docs/backend-owned-content.md)**.

---

## Tests

```bash
npm run test         # Vitest: unit and component tests
npm run test:e2e     # Playwright: the browser flows and the accessibility checks
```

The browser checks cover the storefront, the console, the variants flow and the
responsive behaviour at 360, 390, 414, 768, 1024, 1280 and 1440px.

---

## Documentation

**[docs/README.md](docs/README.md)** is the index. Start there.
