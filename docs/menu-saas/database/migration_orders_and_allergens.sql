-- Run this on existing databases to add order tables and standard allergens.
-- Usage:
--   psql "$DATABASE_URL" -f docs/menu-saas/database/migration_orders_and_allergens.sql

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

insert into allergens (code, icon_url) values
  ('milk', null),
  ('eggs', null),
  ('peanuts', null),
  ('tree_nuts', null),
  ('gluten', null),
  ('soy', null),
  ('fish', null),
  ('shellfish', null),
  ('sesame', null)
on conflict (code) do nothing;
