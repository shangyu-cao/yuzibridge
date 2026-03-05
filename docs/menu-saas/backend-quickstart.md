# Backend Quickstart (Node + Express + PostgreSQL)

## 1) Install deps

```bash
npm install
```

## 2) Configure env

```bash
cp .env.example .env
```

Set your own `DATABASE_URL` and `JWT_SECRET`.

## 3) Prepare database

Apply schema:

```bash
psql "$DATABASE_URL" -f docs/menu-saas/database/schema.postgres.sql
```

If your database was created before order support was added, run migration too:

```bash
psql "$DATABASE_URL" -f docs/menu-saas/database/migration_orders_and_allergens.sql
```

## 4) Seed demo store + admin + menu data

```bash
npm run db:seed
```

Default seeded values (override via `.env`):

- Store slug: `dunwuzhai`
- Admin email: `admin+dunwuzhai@yuzibridge.com`
- Admin password: `ChangeMe123!` (please change immediately in real usage)

## 5) Start API server

```bash
npm run server:dev
```

Default URL:

- `http://localhost:4000`

## 6) Open MenuPage in browser

In another terminal, run frontend dev server:

```bash
npm run dev
```

Open:

- `http://localhost:5173/menu-preview/dunwuzhai`

Notes:

- `/` still shows your company homepage.
- `/menu-preview/:storeSlug` renders the menu page and pulls data from backend API.

## 7) Core endpoints

Public:

- `GET /api/public/stores/:storeSlug/languages`
- `GET /api/public/stores/:storeSlug/menu?lang=en-US`

Admin:

- `POST /api/admin/auth/login`
- `GET/POST/PUT/DELETE /api/admin/stores/:storeId/categories`
- `GET/POST/PUT/DELETE /api/admin/stores/:storeId/items`

## 8) Open merchant admin (categories/items/orders)

Open:

- `http://localhost:5173/merchant-admin`

Use seeded account:

- Email: `admin+dunwuzhai@yuzibridge.com`
- Password: `ChangeMe123!`

After login:

- Select store
- Category CRUD
- Item CRUD (with image upload and allergen checkboxes)
- Order board with actions: `accept` -> `prepare` -> `ready` -> `finish`
