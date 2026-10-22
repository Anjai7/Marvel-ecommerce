# 🛒 Marvel - Premium Tech E-Commerce Marketplace

A refined, high-performance, and visually stunning tech e-commerce platform built using **React** and **Vite**, featuring premium UX patterns inspired by industry leaders like Amazon and Flipkart.

---

## ✨ Features & Interactions

### 🛍️ Smart Shopping & Navigation

- **Stable Category Dropdowns**: Hover-safe mega menu interaction with a 260ms mouseleave debounce and invisible cursor bridges preventing accidental closes or HMR flickers.
- **Intelligent Mega Dropdown Alignment**: Dropdowns in the second half of the navigation bar automatically align to the right to prevent horizontal page overflow and clipping.
- **Layered Elevation System**: Product cards designed with soft dual-layer shadows, vertical lift on hover, and an elegant gradient highlight top rim.

### 🎧 Amazon-Style Product detail Page

- **Sticky Media Gallery Column**: The product image gallery stays locked to the viewport side during scrolling, freeing naturally as soon as the details section ends to avoid overlapping other sections.
- **Vertical & Horizontal Thumbnail Modes**: Dynamic vertical-to-horizontal thumbnail strip adjustments based on device size.
- **Plugin-Style Magnifier Zoom**: Cursor-tracking main image lens magnifier supporting `2.5x` and `4x` selectable zoom levels.
- **Full-Screen Lightbox**: Immersive fullscreen gallery with smooth navigation.

### 📊 Rich Product Information Sections

- **Horizontal Carousel Tabs**: Horizontal tab bar that scrolls smoothly on swipe or via circular navigation arrows. Active tabs dynamically slide into center view.
- **Structured EMI & Partner Bank Offers**: Dash-border partner bank rows with one-click copyable promo codes and EMI breakdown cards.
- **Multi-Step Feedback & Price Match Form**: Interactive 3-step reporting wizard.
- **Regulatory Compliance**: Quality certifications, origin details, HSN, and GST compliance tables.

---

## 🎨 Design System

Consistently styled according to a highly polished brand palette:

- **Primary**: Lighter Flipkart-inspired Navy Blue (`#2874f0`) for primary navigation and core branding elements.
- **Secondary / CTA**: Radiant action Orange (`#ff6100`) for primary buy flows and Add to Cart buttons.
- **Success**: Rich Emerald Green for savings, promotions, and verified stock indicators.
- **Base**: Clean solid white cards overlaying soft cool-gray gradients (`linear-gradient(180deg, #f1f4f8 0%, #e2e8f0 100%)`) for excellent visual contrast.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js 22.12 or newer and npm 10 or newer. The repository includes a `.nvmrc` for nvm users. Browser checks use the installed Chrome channel on Windows by default (override with `PLAYWRIGHT_CHANNEL`) and Playwright Chromium in CI.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Anjai7/Marvel-ecommerce.git
   cd Marvel-ecommerce
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the API and Vite together:
   ```bash
   npm run dev:all
   ```
   Open [http://localhost:5173/](http://localhost:5173/) in your browser. Use `npm run dev` when you only need the frontend.

### Quality checks

```bash
npm run check       # Oxlint, unit/component tests, and production build
npm run test:e2e    # Playwright browser and accessibility checks
npm run audit       # high/critical npm vulnerability gate
```

Prettier, EditorConfig, and Lefthook keep formatting and pre-commit checks consistent. Run `npm run format` to format the project, or `npm run format:check` to inspect formatting without writing files. The repository currently has a legacy formatting baseline (97 files at setup time), so avoid a whole-tree `npm run format` during focused changes. `npm run build:analyze` creates `dist/bundle-report.html`, and `npm run analyze:unused` reports dead code and unused dependencies.

### Building for Production

To build the application for deployment:

```bash
npm run build
```

This generates a minified, production-ready bundle in the `dist` directory.

---

## Dynamic Site Content

Everything the storefront shows is a database row that an **admin** edits from the admin
panel — the hero carousel, the navigation tree, the promo banners, the footer links, and
the category taxonomy. There is no hardcoded content layer left except one fallback
hero slide, so the homepage is never blank.

### The admin editors

Sign in as an admin and open **Site Content** in the sidebar:

| Section        | What it edits                                                      |
| -------------- | ------------------------------------------------------------------ |
| **Menus**      | the 3-level navigation tree and the mega menu                      |
| **Hero**       | the homepage hero carousel                                         |
| **Categories** | the category / subcategory / leaf taxonomy                         |
| **Pages**      | custom marketing, content and category landing pages               |
| **Banners**    | the homepage banner layout, the promo carousel and the promo strip |
| **Footer**     | the footer's link columns and popular-search tags                  |

The full guide is **[docs/admin-content-guide.md](docs/admin-content-guide.md)**.

### Dynamic Pages

Custom marketing, campaign, policy, and category landing pages live at `#/pages/<slug>`
(with a clean-path fallback for `/pages/<slug>`). Pages are assembled from an ordered
stack of sections chosen from a 12-type registry:

- **Hero banner** (`hero`) — full-width hero with heading, subheading, CTA, and theme
- **Rich text** (`richtext`) — safe markdown body (headings, lists, blockquotes, links)
- **Single image** (`image`) — responsive banner or brand asset with caption and link
- **Image gallery** (`gallery`) — responsive 2/3/4-column image grid with lightbox captions
- **Product grid** (`product_grid`) — curated or manual hand-picked products
- **Category grid** (`category_grid`) — child or curated category tiles with badges
- **Promo banner** (`promo_banner`) — promotional offer banner with countdown timer
- **Call to action** (`cta`) — high-conversion action banner with primary and secondary buttons
- **FAQ** (`faq`) — collapsible accordion of questions and answers
- **Video embed** (`video`) — YouTube, Vimeo, or MP4 embed with responsive aspect ratio
- **Category listing** (`category_listing`) — paginated category products with sort and layout controls
- **Spacer** (`spacer`) — configurable vertical whitespace divider

Pages support draft, scheduled, published, and expired states with zero-redeploy instant
publishing: publishing a page or updating its sections is live on the storefront immediately.

### The category taxonomy

Three levels: a **category**, its **subcategories**, and the **leaves** under them. The
seeded tree has 7 categories, 31 subcategories and 149 leaves.

A category's URL is its **whole ancestor path** — `#/category/electronics/mobiles/smartphones`
— because a slug is only unique within its parent (the default tree has three categories
called "accessories"). Every category has its own page, and a product bound to a category
appears on that category's page and on the pages of all its ancestors.

### Applying the schema

The content tables are created by SQL that **you** apply — this machine cannot reach the
database. The bundles, their order, and their verification queries are in
**[docs/sql/README.md](docs/sql/README.md)**:

```
docs/sql/apply-01-content-taxonomy.sql   # the tables + the category seed
docs/sql/apply-02-drop-site-categories.sql  # drops the old table, after the code ships
docs/sql/apply-03-run-seeds.md           # populates banners, footer and products
```

The seeds are also available as npm scripts and are safe to re-run — they upsert by
deterministic id and never delete anything:

```bash
npm run seed:content     # 9 banners, 5 footer sections, 34 links
npm run seed:products    # a product catalogue across the whole taxonomy
```

### Environment variables

`JWT_SECRET` must be **at least 32 characters** — the API refuses to boot in production
with a shorter one. `SUPABASE_SERVICE_ROLE_KEY` is required by the seed scripts, because
the content tables are behind scoped row-level-security policies. `ALLOWED_ORIGINS` is a
comma-separated allowlist for the API's CORS; it defaults to the two localhost dev
origins. See `.env.example` for the full list.

---

## Dynamic Site Content

Every structured content block on the storefront is a database row that an admin can
edit. Nothing on the page is hardcoded any more (the one exception is the homepage
hero's fallback slide, so the homepage is never blank).

### What an admin can edit

**Site Content** in the admin console has one editor per content type:

| Editor         | What it controls                                       |
| -------------- | ------------------------------------------------------ |
| **Menus**      | The navigation tree and the mega-menu                  |
| **Hero**       | The homepage hero carousel                             |
| **Categories** | The three-level category / subcategory / leaf taxonomy |
| **Pages**      | Custom marketing and category landing pages            |
| **Banners**    | The homepage promo layout, carousel and offer strip    |
| **Footer**     | The footer's link columns and popular search tags      |

Products pick a category from the same tree, and the storefront's category pages,
navigation and promo blocks all read from the database. An admin edit reaches the
storefront immediately — no reload, no cache to clear.

### The category taxonomy

Three levels, with the URL carrying the whole chain of ancestors:

```
Electronics        #/category/electronics
└── Mobiles        #/category/electronics/mobiles
    └── Smartphones  #/category/electronics/mobiles/smartphones
```

A slug is unique only within its parent, so the path — not the last segment — is
the identity. That is why the category page is routed on the full path.

### Applying the database side

The schema is applied by hand: this machine cannot reach the database. The
hand-off, in order, is in **[`docs/sql/README.md`](docs/sql/README.md)**:

1. `docs/sql/apply-01-content-taxonomy.sql` — the tables, the scoped RLS policies
   and the seeded taxonomy;
2. deploy the code that reads the new tables;
3. `docs/sql/apply-02-drop-site-categories.sql` — drop the old table;
4. `docs/sql/apply-03-run-seeds.md` — populate the banners, the footer and a
   product catalogue across the taxonomy.

`npm run seed:content` and `npm run seed:products` are idempotent: they upsert by
a deterministic id and never delete.

### Guides

- [`docs/admin-content-guide.md`](docs/admin-content-guide.md) — how to use the
  editors, and what happens on the storefront when you save.
- [`docs/sql/README.md`](docs/sql/README.md) — the database hand-off, the
  verification queries and the rollback.
- [`docs/backend-owned-content.md`](docs/backend-owned-content.md) — the
  contract every value in the app follows: which tables own which content,
  the API shapes, and the rule that nothing is invented in the client.

### Before deploying

`JWT_SECRET` must be **32 characters or more**. The API refuses to boot in
production with a shorter one. Generate a real secret with
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
