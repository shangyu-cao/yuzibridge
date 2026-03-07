-- YUZIBRIDGE multi-store menu translation schema (PostgreSQL)
-- Purpose: one platform serves many stores, each store has isolated menu data.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ========= Common trigger =========
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========= Languages =========
create table if not exists languages (
  code varchar(10) primary key,
  english_name text not null,
  native_name text not null,
  is_rtl boolean not null default false
);

insert into languages (code, english_name, native_name, is_rtl) values
  ('zh-CN', 'Chinese (Simplified)', '简体中文', false),
  ('en-US', 'English (US)', 'English (US)', false),
  ('ja-JP', 'Japanese', '日本語', false),
  ('ko-KR', 'Korean', '한국어', false),
  ('fr-FR', 'French', 'Français', false),
  ('de-DE', 'German', 'Deutsch', false),
  ('es-ES', 'Spanish', 'Español', false),
  ('ar-SA', 'Arabic', 'العربية', true)
on conflict (code) do nothing;

-- ========= Tenant root =========
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique, -- e.g. dunwuzhai
  legal_name text not null,
  brand_name text not null,
  logo_url text,
  default_language_code varchar(10) not null references languages(code),
  default_currency_code char(3) not null default 'USD',
  timezone text not null default 'UTC',
  address_text text,
  contact_phone text,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_stores_updated_at on stores;
create trigger trg_stores_updated_at
before update on stores
for each row execute function set_updated_at();

-- Social media storage removed per product decision.
drop table if exists store_social_links;

create table if not exists store_languages (
  store_id uuid not null references stores(id) on delete cascade,
  language_code varchar(10) not null references languages(code),
  is_default boolean not null default false,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (store_id, language_code)
);

-- Enforce one default language per store
create unique index if not exists uq_store_default_language
  on store_languages (store_id)
  where is_default = true;

-- ========= Identity / authorization =========
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  display_name text,
  is_platform_admin boolean not null default false,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_role') then
    create type membership_role as enum ('owner', 'manager', 'editor', 'viewer');
  end if;
end$$;

create table if not exists store_memberships (
  store_id uuid not null references stores(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role membership_role not null,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index if not exists idx_store_memberships_user on store_memberships (user_id);

-- ========= Menu categories =========
create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_menu_categories_updated_at on menu_categories;
create trigger trg_menu_categories_updated_at
before update on menu_categories
for each row execute function set_updated_at();

create index if not exists idx_menu_categories_store_sort
  on menu_categories (store_id, sort_order);

create table if not exists menu_category_translations (
  category_id uuid not null references menu_categories(id) on delete cascade,
  language_code varchar(10) not null references languages(code),
  name text not null,
  description text,
  translated_by text not null default 'manual'
    check (translated_by in ('manual', 'machine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, language_code)
);

drop trigger if exists trg_menu_category_translations_updated_at on menu_category_translations;
create trigger trg_menu_category_translations_updated_at
before update on menu_category_translations
for each row execute function set_updated_at();

create index if not exists idx_menu_category_translations_lang
  on menu_category_translations (language_code);

-- ========= Menu items =========
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  category_id uuid not null references menu_categories(id) on delete restrict,
  sku text,
  image_url text,
  price_minor integer not null check (price_minor >= 0), -- stored in cents/fen
  currency_code char(3) not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_menu_items_updated_at on menu_items;
create trigger trg_menu_items_updated_at
before update on menu_items
for each row execute function set_updated_at();

create index if not exists idx_menu_items_store_category_sort
  on menu_items (store_id, category_id, sort_order);

create index if not exists idx_menu_items_store_availability
  on menu_items (store_id, is_active, is_available);

create table if not exists menu_item_translations (
  item_id uuid not null references menu_items(id) on delete cascade,
  language_code varchar(10) not null references languages(code),
  name text not null,
  description text,
  translated_by text not null default 'manual'
    check (translated_by in ('manual', 'machine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, language_code)
);

drop trigger if exists trg_menu_item_translations_updated_at on menu_item_translations;
create trigger trg_menu_item_translations_updated_at
before update on menu_item_translations
for each row execute function set_updated_at();

create index if not exists idx_menu_item_translations_lang
  on menu_item_translations (language_code);

-- ========= Allergens =========
create table if not exists allergens (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- peanut, milk, gluten...
  icon_url text,
  created_at timestamptz not null default now()
);

create table if not exists allergen_translations (
  allergen_id uuid not null references allergens(id) on delete cascade,
  language_code varchar(10) not null references languages(code),
  label text not null,
  primary key (allergen_id, language_code)
);

create table if not exists menu_item_allergens (
  item_id uuid not null references menu_items(id) on delete cascade,
  allergen_id uuid not null references allergens(id) on delete restrict,
  primary key (item_id, allergen_id)
);

create index if not exists idx_menu_item_allergens_allergen
  on menu_item_allergens (allergen_id);

-- ========= Orders =========
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('new', 'accepted', 'preparing', 'ready');
  end if;
end$$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  table_code text,
  status order_status not null default 'new',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function set_updated_at();

create index if not exists idx_orders_store_status_created
  on orders (store_id, status, created_at desc);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  item_name_snapshot text not null,
  price_minor integer not null check (price_minor >= 0),
  currency_code char(3) not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order
  on order_items (order_id);

-- ========= Translation job tracking =========
do $$
begin
  if not exists (select 1 from pg_type where typname = 'translation_job_status') then
    create type translation_job_status as enum ('queued', 'processing', 'completed', 'failed');
  end if;
end$$;

create table if not exists translation_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  entity_type text not null check (entity_type in ('store', 'category', 'item')),
  entity_id uuid not null,
  source_language_code varchar(10) not null references languages(code),
  target_language_code varchar(10) not null references languages(code),
  provider text not null, -- deepl, google, openai...
  status translation_job_status not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

drop trigger if exists trg_translation_jobs_updated_at on translation_jobs;
create trigger trg_translation_jobs_updated_at
before update on translation_jobs
for each row execute function set_updated_at();

create index if not exists idx_translation_jobs_status
  on translation_jobs (status, created_at);

create index if not exists idx_translation_jobs_store
  on translation_jobs (store_id, created_at desc);

-- ========= QR metadata (optional) =========
create table if not exists store_qr_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  table_code text, -- null means generic store menu QR
  target_url text not null, -- e.g. /menu/dunwuzhai?table=A1
  qr_image_url text,
  created_at timestamptz not null default now(),
  unique (store_id, table_code)
);

-- ========= Sample read query =========
-- Inputs:
--   :store_slug (text)
--   :lang (varchar(10))
--
-- Behavior:
--   returns translated category/item texts in requested language,
--   falls back to store default language when missing.
--
-- with st as (
--   select id, default_language_code
--   from stores
--   where slug = :store_slug
--     and is_active = true
-- ),
-- categories as (
--   select
--     c.id,
--     c.sort_order,
--     coalesce(ct_req.name, ct_def.name) as category_name
--   from menu_categories c
--   join st on st.id = c.store_id
--   left join menu_category_translations ct_req
--     on ct_req.category_id = c.id and ct_req.language_code = :lang
--   left join menu_category_translations ct_def
--     on ct_def.category_id = c.id and ct_def.language_code = st.default_language_code
--   where c.is_active = true
-- ),
-- items as (
--   select
--     i.id,
--     i.category_id,
--     i.sort_order,
--     i.price_minor,
--     i.currency_code,
--     coalesce(it_req.name, it_def.name) as item_name,
--     coalesce(it_req.description, it_def.description) as item_description
--   from menu_items i
--   join st on st.id = i.store_id
--   left join menu_item_translations it_req
--     on it_req.item_id = i.id and it_req.language_code = :lang
--   left join menu_item_translations it_def
--     on it_def.item_id = i.id and it_def.language_code = st.default_language_code
--   where i.is_active = true and i.is_available = true
-- )
-- select *
-- from categories c
-- join items i on i.category_id = c.id
-- order by c.sort_order, i.sort_order;
