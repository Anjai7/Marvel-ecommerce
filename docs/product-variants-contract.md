# Product options and variants — the contract

Every agent working on this feature builds to this document. If a file's
current shape disagrees with it, the contract wins.

A product may carry **options** (the choices: colour, size, capacity…) and
**variants** (the sellable combinations: "Blue / M", with its own price,
stock and SKU). The admin writes both; the storefront reads them; the cart
and the order carry the customer's choice.

---

## 1. The vocabulary

| Word    | Meaning                                                  |
| ------- | -------------------------------------------------------- |
| option  | one axis of choice — `colour`, `size`, `capacity`        |
| value   | one choice on an axis — `Blue`, `XL`, `256 GB`           |
| variant | one sellable combination of values, with price/stock/SKU |

---

## 2. Option kinds

The allowed kinds are the same list in two places, and a unit test asserts
they match:

- `server/lib/productOptions.js` → `export const OPTION_KINDS = [...]`
- `src/lib/productOptions.js` → `export const OPTION_KINDS = [...]`

The list, in this order:

```
color, size, capacity, storage, material, style, weight, flavour
```

`color` renders as a swatch on the storefront; every other kind renders as
a pill. `label` is what the customer reads ("Colour", "Size"); `value` is
the machine value (a hex for colour, otherwise free text and often the same
as the label).

---

## 3. The database

### `public.product_variants` — the option values (existing table, widened)

```sql
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('color','size','capacity','storage','material','style','weight','flavour')),
  label text not null,
  value text,
  option_value_id uuid references public.product_option_values(id) on delete set null,
  position int not null default 0,
  is_active boolean not null default true
);
```

The migration must **widen** the existing `kind` check (the table may
already exist with `('color','size')` only) and add `option_value_id`.

### `public.product_option_values` — the shared catalogue (new)

```sql
create table if not exists public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('color','size','capacity','storage','material','style','weight','flavour')),
  label text not null,
  value text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (kind, label)
);
```

One row per (kind, label) in the whole store. Renaming the row renames the
option everywhere that links to it.

### `public.product_variant_combinations` — the sellable variants (new)

```sql
create table if not exists public.product_variant_combinations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  price numeric,
  stock int,
  image_url text,
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  is_active boolean not null default true
);
```

`options` is a jsonb array of `{ kind, label, value }` — the choice this
combination represents.

The migration file is `docs/sql/apply-04-product-variants.sql` and it must
be safe to run twice.

---

## 4. The API

### `POST /api/products` and `PUT /api/products/:id` (admin)

Two new optional body fields:

```json
{
  "variants": [
    { "kind": "color", "label": "Blue", "value": "#2563eb", "option_value_id": "uuid-or-null" },
    { "kind": "size", "label": "M", "value": "M", "option_value_id": null }
  ],
  "combinations": [
    {
      "sku": "TSHIRT-BLUE-M",
      "price": 1499,
      "stock": 12,
      "image_url": "https://…",
      "options": [
        { "kind": "color", "label": "Blue", "value": "#2563eb" },
        { "kind": "size", "label": "M", "value": "M" }
      ]
    }
  ]
}
```

Rules the server follows, exactly:

- `variants` **absent** → the product's option values are left alone.
  `variants` **present** (even `[]`) → the product's option values are
  replaced: delete the product's rows, insert the ones sent.
- `combinations` **absent** → left alone. **Present** → replaced the same
  way.
- `kind` must be one of `OPTION_KINDS`; a row with an unknown kind is a
  `400` with `{ "error": "…" }`. `label` is required. `value` is optional.
- `price` must be a number `>= 0` when present; `stock` an integer `>= 0`.
- A combination's `options` is an array of `{ kind, label, value }`.
- The response is unchanged: `{ "message": "…", "product": { … } }`.
- `option_value_id` must exist in `product_option_values`; an unknown id is
  stored as `null` rather than failing the write.

### `GET /api/products/:id/details` (public)

The response gains two fields and keeps everything it has today:

```json
{
  "product": { … },
  "offers": [ … ],
  "reviews": { … },
  "variants": {
    "options": [
      { "id": "uuid", "kind": "color", "label": "Blue", "value": "#2563eb", "position": 0 }
    ],
    "colors": [ … ],   // unchanged: the colour values
    "sizes": [ … ]     // unchanged: the size values
  },
  "combinations": [
    {
      "id": "uuid",
      "sku": "TSHIRT-BLUE-M",
      "price": 1499,
      "stock": 12,
      "image_url": null,
      "options": [ { "kind": "color", "label": "Blue", "value": "#2563eb" } ],
      "position": 0
    }
  ],
  "media": [ … ]
}
```

- `variants.options` is **every** option value of the product, ordered by
  `position`, whatever its kind.
- `variants.colors` and `variants.sizes` stay exactly as they are — the
  storefront and its tests already depend on them.
- When an option value links to a catalogue row, the catalogue's `label`
  and `value` win, so renaming one renames it everywhere.
- A product with no option values returns `options: []` and `combinations:
[]` — never an invented list.

### `GET /api/product-option-values` (public)

The catalogue, so the admin form can offer values the store already uses.
`{ "values": [{ "id", "kind", "label", "value" }] }`, ordered by kind then
label. Reference data, no product rows — served to anonymous callers too.

A value that exists in the catalogue links to it; a value no product has
used yet is created when a product is saved — the first product to use an
option is what puts it in the catalogue. An existing catalogue entry is
never overwritten by a product save, so a rename in the catalogue always
wins.

### The cart and the order

The cart item gains three fields, and the order's `items` jsonb carries
them as they are:

```json
{
  "id": "product-id",
  "title": "…",
  "price": 1499,
  "quantity": 1,
  "combination_id": "uuid-or-null",
  "sku": "TSHIRT-BLUE-M-or-null",
  "options": [{ "kind": "color", "label": "Blue", "value": "#2563eb" }]
}
```

`POST /api/orders` already stores `items` verbatim, so it needs no change —
but the items it receives must carry `options` and `sku` so the admin and
the customer can see what was bought.

---

## 5. The admin

The Add/Edit Product form gains a **"Options & Variants"** section:

- **Options**: one row per option type (kind) with the values on it.
  Add a type from a dropdown, add a value to a type, remove either.
- **Suggestions**: choosing a category offers the kinds and values that
  category usually uses (Apparel → Size, Colour; Electronics → Storage,
  Colour…). One click adds them. The admin can always do it their own way.
- **Variants**: the matrix. One row per combination, one column per option
  type, plus SKU, Price, Stock and an image. "Generate combinations"
  builds every combination of the chosen values with the product's price
  and stock prefilled. Rows are editable and removable.
- A product with no options shows "This product has no options" and no
  matrix.

## 6. The storefront

- The product page renders **every** option type: a swatch for `color`, a
  pill for the rest. The old hard-coded colour/size blocks are gone.
- Choosing values resolves the matching combination: its price and stock
  are what the page shows, and the choice goes into the cart.
- With no combinations, the product's own price and stock are used.
- The cart line shows the chosen options under the product title.

## 7. Rules for everyone

- No inline `style={{…}}` anywhere — the build has a guard for it.
- Every behaviour change gets a test.
- No `git add`, `git commit` or `git push`.
- Do not reformat files you were not asked to change.
