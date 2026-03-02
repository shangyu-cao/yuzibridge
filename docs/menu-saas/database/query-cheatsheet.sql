-- Quick checks for merchant/store/menu data
-- Usage:
--   psql "$DATABASE_URL" -f docs/menu-saas/database/query-cheatsheet.sql

\echo '=== stores ==='
select id, slug, brand_name, default_language_code, is_active
from stores
order by created_at desc;

\echo '=== users ==='
select id, email, display_name, is_active, is_platform_admin
from users
order by created_at desc;

\echo '=== store memberships ==='
select store_id, user_id, role
from store_memberships
order by store_id, user_id;

\echo '=== categories (with zh-CN name) ==='
select
  c.id,
  c.store_id,
  c.sort_order,
  c.is_active,
  t.name as zh_name
from menu_categories c
left join menu_category_translations t
  on t.category_id = c.id and t.language_code = 'zh-CN'
order by c.store_id, c.sort_order;

\echo '=== items (with zh-CN name) ==='
select
  i.id,
  i.store_id,
  i.category_id,
  i.price_minor,
  i.currency_code,
  i.is_active,
  i.is_available,
  t.name as zh_name
from menu_items i
left join menu_item_translations t
  on t.item_id = i.id and t.language_code = 'zh-CN'
order by i.store_id, i.sort_order;

\echo '=== item allergens ==='
select
  mia.item_id,
  a.code as allergen_code
from menu_item_allergens mia
join allergens a on a.id = mia.allergen_id
order by mia.item_id, a.code;
