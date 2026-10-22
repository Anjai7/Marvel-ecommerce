-- ====================================================
-- CMS PAGES + SECTION BUILDER
--
-- Additive and re-runnable: every table is created if not exists, every
-- index is created if not exists, every column is added if not exists, and
-- every policy is dropped before it is created. This file only creates
-- objects -- it never removes a table, a row or any data.
--
-- Contents:
--   1. pages                    (one CMS page: slug, lifecycle, SEO, optional category)
--   2. page_sections            (the ordered, type-tagged sections of a page)
--   3. category page configuration columns
--   4. indexes
--   5. row level security
--   6. set_updated_at() triggers
--
-- Contract: docs/backend-owned-content.md
-- ====================================================

-- ─── 1. pages ───
-- `slug` is the URL segment and is globally unique: a page has no parent, so
-- the bare slug IS its identity (unlike categories, where a slug is unique
-- only per parent).
-- `status` is the editorial lifecycle: draft -> scheduled -> published ->
-- archived. A boolean cannot express "draft" and "published" at once, so
-- this table deliberately does not use the `is_active` convention that the
-- content tables use.
-- `sections` live in `page_sections`, not in a JSON blob on this row: a page
-- section references products, and "which pages feature product X?" must be
-- an indexed lookup rather than a full-table JSONB scan.

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text,
  kind text not null default 'landing',
  template text not null default 'landing',
  status text not null default 'draft',
  published_at timestamptz,
  scheduled_at timestamptz,
  expired_at timestamptz,
  category_id uuid references public.categories(id) on delete cascade,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pages_kind_check check (kind in ('landing','policy','about','faq','contact','campaign','brand','category','collection')),
  constraint pages_template_check check (template in ('landing','category','standard')),
  constraint pages_status_check check (status in ('draft','scheduled','published','archived'))
);

-- ─── 2. page_sections ───
-- One row per section. `type` is a closed allowlist so an unknown section
-- type is impossible to store even if the API is bypassed. `data` holds the
-- per-type payload and `style` the shared spacing/background, so adding a
-- new section type needs no migration.
-- `position` is 0-based and dense within the page.

create table if not exists public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  type text not null,
  position int not null,
  enabled boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint page_sections_type_check check (type in (
    'hero','richtext','image','gallery','product_grid','category_grid',
    'promo_banner','cta','faq','video','category_listing','spacer'
  ))
);

-- ─── 3. category page configuration ───
-- A category must work with no custom page: the built-in default category
-- template reads these columns. A category that DOES have a `pages` row
-- overrides them with that page's sections and seo. This is what makes
-- "creating a category makes its route functional" true without a page row.
--
-- Every column is nullable and has no default: a null means "not configured",
-- and the storefront falls back to the category's own name and description
-- rather than inventing a value.

alter table public.categories add column if not exists meta_title text;
alter table public.categories add column if not exists meta_description text;
alter table public.categories add column if not exists canonical_url text;
alter table public.categories add column if not exists listing_layout text;
alter table public.categories add column if not exists listing_sort text;
alter table public.categories add column if not exists listing_page_size int;

-- ─── 4. indexes ───
-- The slug is the URL, so it is case-insensitively unique.
create unique index if not exists pages_slug_unique
  on public.pages (lower(slug));
create unique index if not exists pages_category_unique
  on public.pages (category_id) where category_id is not null;
create index if not exists pages_status_slug
  on public.pages (status, slug);
create unique index if not exists page_sections_position_unique
  on public.page_sections (page_id, position);
create index if not exists page_sections_type
  on public.page_sections (type);

-- ─── 5. row level security ───
-- The Express API connects with the service-role key and bypasses RLS, so
-- the route guards in server/routes/pages.js are the primary control. These
-- policies are defense in depth for any client that connects with the anon
-- key. The public predicate mirrors the `isPublicPage` predicate in
-- server/routes/pages.js: published, and inside its scheduled/expired window.

alter table public.pages enable row level security;
drop policy if exists "Public read published pages" on public.pages;
create policy "Public read published pages" on public.pages
  for select to anon, authenticated
  using (
    status = 'published'
    and (scheduled_at is null or scheduled_at <= timezone('utc', now()))
    and (expired_at is null or expired_at > timezone('utc', now()))
  );
drop policy if exists "Service role full access on pages" on public.pages;
create policy "Service role full access on pages" on public.pages
  for all to service_role using (true) with check (true);

alter table public.page_sections enable row level security;
drop policy if exists "Public read sections of published pages" on public.page_sections;
create policy "Public read sections of published pages" on public.page_sections
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.pages p
      where p.id = public.page_sections.page_id
        and p.status = 'published'
        and (p.scheduled_at is null or p.scheduled_at <= timezone('utc', now()))
        and (p.expired_at is null or p.expired_at > timezone('utc', now()))
    )
  );
drop policy if exists "Service role full access on page_sections" on public.page_sections;
create policy "Service role full access on page_sections" on public.page_sections
  for all to service_role using (true) with check (true);

-- ─── 6. updated_at triggers ───
-- set_updated_at() already exists (20261020000007). The trigger overwrites any
-- client-supplied updated_at; the API never writes that column.
-- `create or replace trigger` (PostgreSQL 14+) keeps this file re-runnable in a
-- single statement per table: re-running replaces the existing trigger instead
-- of failing on the duplicate name.

create or replace trigger trg_set_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

create or replace trigger trg_set_updated_at before update on public.page_sections
  for each row execute function public.set_updated_at();
