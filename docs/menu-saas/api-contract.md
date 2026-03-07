# Menu SaaS API Contract (MVP)

## Base conventions

- Public APIs are read-only and keyed by `storeSlug`.
- Admin APIs are keyed by `storeId` and require auth token.
- `lang` uses BCP-47 code (`zh-CN`, `en-US`, `ja-JP`...).
- Prices are returned as `priceMinor` + `currency` (frontend formats display).

---

## 1) Public APIs

### GET `/api/public/stores/:storeSlug/languages`

Returns enabled languages for this store.

```json
{
  "storeSlug": "dunwuzhai",
  "defaultLanguage": "zh-CN",
  "languages": [
    { "code": "zh-CN", "name": "简体中文" },
    { "code": "en-US", "name": "English (US)" },
    { "code": "ja-JP", "name": "日本語" }
  ]
}
```

### GET `/api/public/stores/:storeSlug/menu?lang=en-US`

Returns full menu payload for one store in target language with fallback already resolved on server.

```json
{
  "store": {
    "id": "uuid",
    "slug": "dunwuzhai",
    "name": "Dunwuzhai",
    "logoUrl": "https://...",
    "address": "Shanghai...",
    "phone": "+86 21 5555 8888"
  },
  "lang": "en-US",
  "categories": [
    {
      "id": "uuid",
      "name": "Chef's Specials",
      "sortOrder": 1,
      "items": [
        {
          "id": "uuid",
          "name": "Signature Beef Noodles",
          "description": "Slow-braised beef brisket...",
          "priceMinor": 5800,
          "currency": "CNY",
          "imageUrl": "https://...",
          "allergens": ["Gluten", "Soy"]
        }
      ]
    }
  ]
}
```

### POST `/api/public/stores/:storeSlug/orders`

Create order from menu page basket.

Request:

```json
{
  "tableCode": "A1",
  "items": [
    { "menuItemId": "uuid", "quantity": 2 },
    { "menuItemId": "uuid", "quantity": 1 }
  ]
}
```

---

## 2) Admin APIs

### Category CRUD

- `POST /api/admin/stores/:storeId/categories`
- `PUT /api/admin/stores/:storeId/categories/:categoryId`
- `DELETE /api/admin/stores/:storeId/categories/:categoryId`
- `GET /api/admin/stores/:storeId/categories`

### Item CRUD

- `POST /api/admin/stores/:storeId/items`
- `PUT /api/admin/stores/:storeId/items/:itemId`
- `DELETE /api/admin/stores/:storeId/items/:itemId`
- `GET /api/admin/stores/:storeId/items`

### Item image upload

- `POST /api/admin/stores/:storeId/uploads/image` (multipart `file`)

### Allergen options

- `GET /api/admin/stores/:storeId/allergens`

### Orders

- `GET /api/admin/stores/:storeId/orders`
- `PATCH /api/admin/stores/:storeId/orders/:orderId/status` (`accepted|preparing|ready`)
- `DELETE /api/admin/stores/:storeId/orders/:orderId` (for finish confirmation delete)

### Store settings

- `GET /api/admin/stores/:storeId/profile`
- `PUT /api/admin/stores/:storeId/profile`

### Translation management

- `POST /api/admin/stores/:storeId/translations/jobs` (enqueue machine translation)
- `GET /api/admin/stores/:storeId/translations/jobs`
- `PUT /api/admin/stores/:storeId/translations/categories/:categoryId`
- `PUT /api/admin/stores/:storeId/translations/items/:itemId`

---

## 3) Authorization model

- JWT auth for admin endpoints.
- Every admin request checks store membership:
  - `owner`, `manager`, `editor`, `viewer`
- Public endpoints require no auth.

---

## 4) Caching strategy

- Cache public menu response by key: `menu:{storeId}:{lang}`
- Invalidate on:
  - item/category/profile updates
  - translation update completion
- Suggested TTL: 5-15 minutes + explicit invalidation.
