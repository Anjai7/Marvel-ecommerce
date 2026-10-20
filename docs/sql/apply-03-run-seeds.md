# Apply 03 — run the content and product seeds

**Who runs this:** the human partner, against the Supabase project.
**When:** after `docs/sql/apply-01-content-taxonomy.sql` has been applied successfully and the
API is pointed at the same project.

Both scripts are **idempotent and non-destructive**. They use deterministic UUIDs plus
`upsert(..., { onConflict: "id" })`, never `delete`, never `truncate`, and the product seed
never writes an order. Running either one twice must leave every row count unchanged.

---

## 1. Prerequisites

1. **`apply-01-content-taxonomy.sql` has been applied.** The content seed reads the
   `menu_items` mega-menu tree and the product seed reads `public.categories`; without the
   bundle both fail fast with an explanatory message.
   Verify:

   ```sql
   SELECT level, count(*) FROM public.categories GROUP BY level ORDER BY level;
   -- Expected: 7 / 31 / 149
   ```

2. **`.env` contains `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.** These are the only
   variables the scripts need. Values stay in `.env` (gitignored) and must never be pasted
   into this document, a log, or a commit.

3. **Node.js >= 22.12.0 and `node_modules` installed** (`npm install`).

No Docker, no linked Supabase CLI project, and no database password are required: the scripts
talk to the REST API with the service-role key.

---

## 2. Run the seeds, in this order

```bash
npm run seed:content
npm run seed:products
```

`seed:content` writes `categories` (from `menu_items`), `promo_banners` (9 rows),
`footer_sections` (5 rows) and `footer_links` (34 rows). It prints a count summary.

`seed:products` reads the live `categories` tree and writes the catalog: 3 products per
level-1 category, 1 per level-2 category and 1 per level-3 leaf, all bound by `category_id`
and labelled with the category name.

**Image handling.** `npm run seed:products` uploads images to Cloudinary only when
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are all set. When
they are not, the plain Unsplash URL is stored directly with `access_type = "public"`. A
`cloudinary_public_id` is only ever written from a real upload — never fabricated.

---

## 3. Verification queries

```sql
SELECT count(*) FROM public.promo_banners;      -- 9
SELECT count(*) FROM public.footer_sections;   -- 5
SELECT count(*) FROM public.footer_links;      -- 34
SELECT count(*) FROM public.products;          -- >= 52 (201 on a fresh taxonomy: 3*7 + 31 + 149)
```

Optional sanity checks:

```sql
-- One banner of each placement, 3/3/3.
SELECT placement, count(*) FROM public.promo_banners GROUP BY placement ORDER BY placement;

-- 3, 3, 3, 3, 10.
SELECT heading, count(*) FROM public.footer_sections s
JOIN public.footer_links l ON l.section_id = s.id
GROUP BY s.heading, s.display_order ORDER BY s.display_order;

-- No product is unbound, and no category page is empty.
SELECT count(*) FROM public.products WHERE category_id IS NULL;   -- 0
SELECT count(*) FROM public.products;                            -- > 0

-- Every level-2 and level-3 category has at least one product.
SELECT c.level, count(*) AS categories_without_products
FROM public.categories c
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.category_id = c.id)
GROUP BY c.level ORDER BY c.level;                               -- no rows
```

---

## 4. Idempotency gate

Run both commands a second time:

```bash
npm run seed:content
npm run seed:products
```

Then re-run the four `count(*)` queries from section 3. Every count must be **identical** to
the first run. A count that grew means the upsert key is wrong (a missing or non-deterministic
id), and that must be fixed before the seeds are considered done.

---

## 5. If something fails

| Symptom                                                                    | Cause                                                                 | Fix                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| `Could not read categories: relation "public.categories" does not exist`   | `apply-01` was not applied                                            | Apply `docs/sql/apply-01-content-taxonomy.sql` first |
| `No categories found. Apply docs/sql/apply-01-content-taxonomy.sql first.` | The table exists but the category seed did not run or was rolled back | Re-apply the second half of `apply-01`               |
| `Could not upsert categories: ... violates foreign key constraint`         | A level-2/3 row is missing its parent in `menu_items`                 | Fix the `menu_items` rows, then re-run               |
| `seed:products` warns about an image fetch                                 | Unsplash is unreachable; the row still gets a deterministic URL       | Re-run when the network is available                 |

Nothing in either script prints an environment value; the failure messages only carry the
Supabase error text.
