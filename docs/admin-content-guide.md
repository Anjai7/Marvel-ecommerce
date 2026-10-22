# Admin content guide

Everything on the storefront that used to be hardcoded is now editable from the admin
panel: the hero carousel, the navigation tree, the promo banners, the footer links, and
the category taxonomy.

Open the admin panel and find **Site Content** in the sidebar. It has five sections:

| Section        | What it edits                               | Where it shows up                                                   |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| **Menus**      | the navigation tree (3 levels)              | the header navigation and the mega menu                             |
| **Hero**       | the homepage hero carousel                  | the top of the homepage                                             |
| **Categories** | the category taxonomy (3 levels)            | the homepage category strip, the navigation, and the category pages |
| **Banners**    | the promo blocks                            | the homepage banner layout and the promo carousel                   |
| **Footer**     | the footer link columns and the search tags | the page footer                                                     |
| **Pages**      | custom campaign, policy & landing pages     | public route `#/pages/<slug>` and custom category page layouts      |

---

## Pages

The CMS page builder allows creating dynamic marketing, campaign, policy, and landing pages with rich composable section components.

### Dynamic URL and Slug Rules

- Each page is mapped to `#/pages/<slug>`.
- The slug must match `/^[a-z0-9]+(-[a-z0-9]+)*$/` (lowercase letters, numbers, single hyphens, no slashes). Reserved system slugs (such as `admin`, `api`, `login`, `cart`, `checkout`) are disallowed.

### Section Types

Pages are composed of 12 validated section types:

1. **Hero banner** (`hero`) — headline, eyebrow, CTA link, media.
2. **Rich text** (`richtext`) — markdown-rendered copy (safe React elements only, no XSS).
3. **Image** (`image`) — responsive image with alt text and optional safe link.
4. **Gallery** (`gallery`) — multi-image grid.
5. **Product grid** (`product_grid`) — product cards with server-side search picker, limits, and columns.
6. **Category grid** (`category_grid`) — category tiles linking to category paths.
7. **Promo banner** (`promo_banner`) — promotional offer badge, headline, CTA.
8. **CTA** (`cta`) — call-to-action block.
9. **FAQ** (`faq`) — accordion question/answer list.
10. **Video** (`video`) — safe embed video player.
11. **Category listing** (`category_listing`) — paginated or full category product catalog with configurable sort and filters.
12. **Spacer** (`spacer`) — vertical whitespace layout divider.

### Ordering and Section Controls

Inside the page editor, sections can be:

- Moved up or down with dedicated accessible order controls.
- Duplicated with a single click.
- Deactivated (hidden) without deleting.
- Edited via generated configuration forms with type-specific inputs (including `ProductPicker` and `CategoryPicker`).
- Saved in one atomic batch via `PUT /api/pages/:id/sections`.

### Publishing, Scheduling, and Preview

- **Draft**: Page is saved but only visible via authenticated admin preview (`#/pages/<slug>?preview=1`). Public requests answer 404.
- **Published**: The page is immediately live on `#/pages/<slug>` without requiring any site build or redeploy.
- **Scheduled**: Specify a future `scheduled_at` timestamp. The page becomes public automatically once the clock passes the schedule time.
- **Expired**: Optional `expired_at` timestamp automatically unpublishes the page once past.
- **Archived**: Archived pages are hidden from public view and marked archived in the admin list.

---

## Categories

The taxonomy is three levels: a **category**, its **subcategories**, and the **leaves**
under them. The seeded tree has 7 categories, 31 subcategories and 149 leaves.

### Add a category

1. **Site Content → Categories**.
2. **Add Top-Level Category**.
3. Fill in the form:
   - **Name** — what the shopper sees. Required.
   - **Slug** — the URL segment. It is pre-filled from the name and stops following the
     name as soon as you edit it. It must be lowercase letters, numbers and hyphens.
   - **Icon** — the Lucide icon name shown in the navigation.
   - **Category image** and **Banner image** — upload them, or paste a URL.
   - **Description** — shown on the category page.
   - **Display order** — where it sits among its siblings.
   - **Active** — an inactive category is hidden from the storefront but stays here.
   - **Show in navigation** and **Show on the homepage** — the two independent visibility
     switches.
4. **Save Category**.

### Add a subcategory

Use the **+** button on the parent node. The subcategory's level is derived from its
parent, and you can add children up to three levels deep.

### Move or rename a category

Click **Edit**. Changing the **parent** moves the category, and its level follows. Changing
the **slug** changes the URL of that category **and of every category under it**, because
the path is built from the slugs of the ancestors. The editor warns you before you save.
Changing only the **name** changes the display text and nothing else.

### Delete a category

Click **Delete**. The confirmation states how many subcategories will be deleted with it —
deleting a category cascades to everything under it.

### Attach a product to a category

The product form's **Category** control is a tree picker. Pick the deepest category the
product belongs to: the product then appears on that category's page **and** on the pages
of all its ancestors. Leaving it as _— Uncategorised —_ puts the product on no category
page at all.

---

## Menus

The navigation tree is three levels and drives the header bar and the mega menu.

- Each node has a **title**, a **path**, an **icon**, an optional **badge**, and the
  roles that may see it.
- A node can be attached to a **category**, which fills its path in from that category's
  ancestors — so a menu entry always points at a real category page.
- The **up** and **down** arrows reorder a node among its siblings.
- **Include inactive** shows the rows that are currently hidden, so nothing can get lost.
- A new menu entry is **active** by default. Switch it off to hide it from the storefront
  without deleting it.

---

## Hero

The homepage hero carousel. Each slide has a badge, a title, a subtitle, a button, and
three images (background, product, fallback). The **up** and **down** arrows reorder the
slides.

The button's **path** is where the shopper lands when they click it — a hash route such as
`#/category/electronics` or `#/products`.

---

## Banners

Three placements, switched with the tabs at the top of the editor:

| Placement               | What it is                                    | Fields                                                                                                                          |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Home banner layout**  | the big block and the two small ones under it | title, subtitle, button, image, and whether it is the `large` or a `small` tile                                                 |
| **Home promo carousel** | the rotating promo strip                      | badge, title, highlight, description, button, a gallery of images, and an optional end date (the countdown is computed from it) |
| **Promo strip**         | the small offer tiles                         | title, subtitle, emoji, offer code, accent colour, background colour, button                                                    |

A banner whose variant is neither `large` nor `small` renders as a small tile.

---

## Footer

Two panes. The left lists the **sections** (the footer's columns); the right lists the
**links** inside the section you select.

- A section is either **links** or **tags**. A tags section renders as a row of pills
  (the "Popular Searches" row).
- A link's **href** is a **hash route** — `#/category/electronics`, `#/account`,
  `#/products`, `#/`. A bare path such as `/help` is not a route in this app and would
  reload the page into a 404, so always use the `#/` form.
- Deleting a section deletes its links. The confirmation says how many.

---

## After you save

The storefront picks the change up immediately — every editor broadcasts an update and the
site reloads the content. You do not need to refresh, and you do not need to rebuild.

If the storefront still shows the old copy, hard-reload the browser once: the content is
cached in memory for the life of the tab.

---

## Who can change what

Only an **admin** or a **super admin** can write to the content API, create, edit, publish or delete pages. Every write route answers `401` without a token and `403` for any other role, and the server checks this before it touches the database.

| Role                | Categories    | Menus, Hero, Banners, Footer | CMS Pages                                   |
| ------------------- | ------------- | ---------------------------- | ------------------------------------------- |
| **Super Admin**     | Full access   | Full access                  | Full access (create, edit, publish, delete) |
| **Admin**           | Full access   | Full access                  | Full access (create, edit, publish, delete) |
| **Vendor**          | Read taxonomy | Read-only                    | None                                        |
| **User / Customer** | View active   | View active                  | View published within schedule              |

---

## Where the data lives

The content is in these tables: `categories`, `hero_slides`, `promo_banners`, `footer_sections`, `footer_links`, `menu_items`, `pages`, and `page_sections`. The schema and migrations are described in [`docs/sql/README.md`](./sql/README.md).
