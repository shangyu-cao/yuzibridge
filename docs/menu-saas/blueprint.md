# YUZIBRIDGE Multi-Store Menu Translation Blueprint

## 1) Product boundaries (keep company website unchanged)

- Keep current company website (`App.jsx`) as-is.
- Build menu product as a separate module/service:
  - Public menu page (for diners after QR scan)
  - Merchant admin console (store staff CRUD)
  - Translation worker (async machine translation + manual override)

Recommended URL patterns:

- Public menu by store slug: `https://www.yuzibridge.com/menu/{storeSlug}`
  - Example: `https://www.yuzibridge.com/menu/dunwuzhai`
- Merchant admin: `https://www.yuzibridge.com/merchant/{storeSlug}`
- Optional table routing for dine-in: `?table=A1`
- Optional custom domain later: `{storeSlug}.menu.yuzibridge.com`

> Note: `storeSlug` maps to one `store_id` in database.

---

## 2) Required UI blocks

### Public menu page

1. Header  
   - Store logo/name  
   - Language switcher
2. Main section  
   - Left: category list  
   - Right: menu items (name, description, price, allergens)
3. Footer  
   - Address  
   - Social links

### Merchant admin

- Category CRUD
- Item CRUD
- Item allergen binding
- Store profile settings (logo/address/socials)
- Translation management (machine result + manual edit + publish)

---

## 3) Multi-tenant model (sell to many clients)

Tenant key: `store_id`.

All business tables include store context directly or via FK chain:

- `stores` (tenant root)
- `menu_categories` (`store_id`)
- `menu_items` (`store_id`, `category_id`)
- translations linked to category/item/store

Isolation rules:

- Public API reads by `storeSlug -> store_id`
- Admin API must check `user_id + store_id` membership/role
- Cache keys use `store_id + lang` to avoid cross-store leak

---

## 4) Language and translation strategy (for smooth switching)

Do **not** translate on every user click.

Use pre-generated translations in DB:

1. Merchant updates source text (for example, zh-CN)
2. Create async translation jobs for enabled target languages
3. Worker writes translated rows into translation tables
4. Merchant can manually edit and override machine text
5. Frontend switch language = fast DB read + cache hit

Fallback order for any missing text:

1. requested language
2. store default language
3. system fallback (`en-US`)

---

## 5) API shape (summary)

Public:

- `GET /api/public/stores/:storeSlug/menu?lang=ja-JP`
- `GET /api/public/stores/:storeSlug/languages`

Merchant:

- `POST/PUT/DELETE /api/admin/stores/:storeId/categories`
- `POST/PUT/DELETE /api/admin/stores/:storeId/items`
- `PUT /api/admin/stores/:storeId/translations/*`
- `PUT /api/admin/stores/:storeId/profile`

---

## 6) Implementation milestones

1. **DB migration**  
   Apply `docs/menu-saas/database/schema.postgres.sql`.
2. **Public menu API**  
   Build one endpoint that returns fully assembled translated menu.
3. **Frontend menu route**  
   Render header/sidebar/items/footer from that API payload.
4. **Admin CRUD**  
   Categories/items/allergens/store profile.
5. **Translation queue**  
   Worker + retries + dead-letter handling.
6. **Performance**  
   Cache by `store_id + lang`; prewarm default languages.
7. **Security**  
   Role-based admin auth and audit logs.

---

## 7) Non-functional targets

- Language switch response target: < 300ms (cache hit)
- Public menu should remain readable even with partial translation (fallback)
- No tenant data leakage (strict store scoping)
- Translation and admin changes observable via logs/metrics
