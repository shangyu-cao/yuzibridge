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

## 4) Create initial admin user

You can insert an admin user manually, then generate `password_hash` via bcrypt in your own script/tool.

Required tables:

- `users`
- `store_memberships`
- `stores`

## 5) Start API server

```bash
npm run server:dev
```

Default URL:

- `http://localhost:4000`

## 6) Core endpoints

Public:

- `GET /api/public/stores/:storeSlug/languages`
- `GET /api/public/stores/:storeSlug/menu?lang=en-US`

Admin:

- `POST /api/admin/auth/login`
- `GET/POST/PUT/DELETE /api/admin/stores/:storeId/categories`
- `GET/POST/PUT/DELETE /api/admin/stores/:storeId/items`
