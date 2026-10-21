# Backend-owned content — contract

**Goal:** no screen may invent data. Every product attribute, offer, review,
setting and marketing line comes from the database. Where the database has no
value, the screen shows nothing — never a fabricated placeholder.

This document is the contract between the server work and the frontend work.
Both sides follow it exactly.

## 1. New tables

All DDL lives in one migration: `supabase/migrations/20261021000010_backend_owned_content.sql`.
Every statement is idempotent (`if not exists`, guarded `alter table`).

### `site_settings`

```sql
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  group_name text not null default 'general',
  updated_at timestamptz not null default timezone('utc', now())
);
```

### `product_offers`

```sql
create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('emi', 'bank', 'coupon')),
  title text,
  bank text,
  code text,
  description text,
  months int,
  amount numeric,
  interest text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);
```

### `product_reviews`

```sql
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_name text not null,
  author_avatar text,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
```

### `product_variants`

```sql
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('color', 'size')),
  label text not null,
  value text,
  position int not null default 0,
  is_active boolean not null default true
);
```

### `product_media`

```sql
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  kind text not null default 'gallery' check (kind in ('gallery', 'hero', 'thumb')),
  position int not null default 0,
  is_active boolean not null default true
);
```

### `wishlist`

```sql
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);
```

### New `products` columns

```sql
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists offer_text text;
alter table public.products add column if not exists offer_ends_at timestamptz;
alter table public.products add column if not exists warranty text;
alter table public.products add column if not exists highlights jsonb;
alter table public.products add column if not exists specifications jsonb;
alter table public.products add column if not exists dimensions jsonb;
alter table public.products add column if not exists materials jsonb;
alter table public.products add column if not exists care_instructions jsonb;
alter table public.products add column if not exists certifications jsonb;
alter table public.products add column if not exists in_box jsonb;
alter table public.products add column if not exists delivery_info jsonb;
alter table public.products add column if not exists user_guide jsonb;
```

All of them are nullable and have no default. A null column means "not
configured", never "invent a value".

## 2. API

### `GET /api/settings` — public, no auth

```json
{ "settings": { "currency": { "code": "INR", "symbol": "₹", "locale": "en-IN" } } }
```

`settings` is a flat map of `key` → the stored JSON value. Missing keys are
omitted. Known keys and their shapes:

| key         | shape                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `currency`  | `{ code, symbol, locale }`                                                                                                                                   |
| `store`     | `{ name, tagline, description, country, support_email, support_phone, logo_url }`                                                                            |
| `shipping`  | `{ free_threshold, standard_days, express_available, return_days }`                                                                                          |
| `inventory` | `{ low_stock_threshold }`                                                                                                                                    |
| `footer`    | `{ value_props: [{ icon, title, subtitle }], payment_methods: [string], socials: [{ label, href, icon }], copyright, security_note, brand_logo, brand_alt }` |
| `trust`     | `{ promises: [{ title, subtitle }] }`                                                                                                                        |
| `reviews`   | `{ allow_write: true }`                                                                                                                                      |

### `GET /api/products/:id/details` — public

```json
{
  "product": { "...": "the product row, including the new columns" },
  "offers": [
    {
      "kind": "emi|bank|coupon",
      "title": "",
      "bank": "",
      "code": "",
      "description": "",
      "months": 6,
      "amount": 1499.5,
      "interest": "No Cost"
    }
  ],
  "reviews": {
    "overall": 4.6,
    "total": 128,
    "breakdown": { "5": 96, "4": 20, "3": 8, "2": 2, "1": 2 },
    "items": [
      {
        "id": "",
        "author_name": "",
        "author_avatar": "",
        "rating": 5,
        "title": "",
        "body": "",
        "is_verified": true,
        "created_at": ""
      }
    ]
  },
  "variants": {
    "colors": [{ "id": "", "label": "", "value": "#1e293b" }],
    "sizes": [{ "id": "", "label": "", "value": "" }]
  },
  "media": [{ "id": "", "url": "", "kind": "gallery" }]
}
```

- `reviews.overall` is the average of the stored review rows, rounded to one
  decimal. It is **not** `products.rating`.
- `reviews.total` is the number of stored review rows.
- `reviews.breakdown` counts stored rows per star, keys `"1"`–`"5"`, only the
  stars that occur.
- `reviews.items` is ordered newest first.
- `variants.colors` / `variants.sizes` are grouped by `kind`, ordered by
  `position`.
- `media` is ordered by `position`.
- 404 when the product does not exist.

### `GET /api/account/wishlist` — requires a logged-in user

```json
{
  "items": [
    { "id": "", "product_id": "", "created_at": "", "product": { "...": "the product row" } }
  ]
}
```

Also `POST /api/account/wishlist` with `{ "product_id": "<uuid>" }` (201, or the
existing item) and `DELETE /api/account/wishlist/:productId` (204). Both
require a logged-in user and act only on the caller's own rows.

## 3. Frontend rules

1. **No fabrication.** A missing value renders as nothing, or as the neutral
   em dash `—`. Never a made-up price, rating, discount, offer, review,
   colour, size, date, name or email.
2. **No hardcoded business data.** The EMI table, bank offers, coupon codes,
   review list and rating breakdown, colour and size swatches, product gallery
   and the seller block come from `GET /api/products/:id/details`.
3. **No hardcoded settings.** The currency symbol and locale, the country, the
   free-shipping threshold, the low-stock threshold, the footer's value props,
   payment chips, social links and copyright, and the trust promises come from
   `GET /api/settings`.
4. **No fake countdown.** A "deal ends in" timer renders only when the product
   has `offer_ends_at` in the future.
5. **No fake review counts.** The rating breakdown and total come from the
   stored reviews.
6. **The currency module reads the backend.** `src/lib/currency.js` keeps its
   current values as the fallback, but the live symbol/locale come from the
   settings context.

## 4. File ownership (so parallel work never collides)

| Owner   | Files                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| server  | `server/**`, `supabase/migrations/20261021000010_backend_owned_content.sql`, `src/api/**`                                                                                                               |
| admin   | `src/components/admin/**`                                                                                                                                                                               |
| chrome  | `src/components/Footer.jsx`, `src/components/Header.jsx`, `src/components/ui/CommandSearch.jsx`, `src/components/customer/CustomerPortal.jsx`, `src/context/SettingsContext.jsx`, `src/lib/currency.js` |
| product | `src/components/product/**`, `src/components/ProductCard.jsx`                                                                                                                                           |

## 5. Rules that already exist and must be kept

- `src/components/ContentDrivenSurfaces.test.jsx` locks the content contract.
  The footer chrome and the hero rescue slide were _required_ to stay in code
  by that file; they now come from the backend, so **that file must be
  updated** to assert the new source. Do not weaken the rest of its contract.
- `src/context/ContentContext.test.jsx` locks the content-context contract.
- The admin console has **no** demo or mock data path, and must keep it that
  way.
