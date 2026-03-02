import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../db/pool.js";
import { authenticateAdmin, requireStoreRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";
import { ensureCategoryBelongsStore, getActiveStoreForAdmin } from "../services/store-service.js";

const router = express.Router();
router.use(authenticateAdmin);

const readOnlyRoles = ["owner", "manager", "editor", "viewer"];
const editRoles = ["owner", "manager", "editor"];
const manageRoles = ["owner", "manager"];

const storeParamsSchema = z.object({
  storeId: z.string().uuid(),
});

const categoryParamsSchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

const itemParamsSchema = z.object({
  storeId: z.string().uuid(),
  itemId: z.string().uuid(),
});

const languageQuerySchema = z.object({
  lang: z.string().min(2).max(10).optional(),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  languageCode: z.string().min(2).max(10).optional(),
});

const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(4000).nullable().optional(),
  priceMinor: z.number().int().min(0),
  currencyCode: z.string().trim().toUpperCase().length(3).optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  isAvailable: z.boolean().optional().default(true),
  allergenCodes: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
});

const updateItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(4000).nullable().optional(),
  priceMinor: z.number().int().min(0).optional(),
  currencyCode: z.string().trim().toUpperCase().length(3).optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  languageCode: z.string().min(2).max(10).optional(),
  allergenCodes: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
});

const normalizeAllergenCodes = (codes = []) => {
  return [...new Set(codes.map((code) => code.trim().toLowerCase()).filter(Boolean))];
};

const resolveAllergenIds = async (dbClient, allergenCodes) => {
  const codes = normalizeAllergenCodes(allergenCodes);
  if (codes.length === 0) {
    return [];
  }

  const result = await dbClient.query(
    `
      select id, code
      from allergens
      where code = any($1::text[])
    `,
    [codes],
  );

  const foundCodeSet = new Set(result.rows.map((row) => row.code));
  const missing = codes.filter((code) => !foundCodeSet.has(code));

  if (missing.length > 0) {
    throw new HttpError(400, "Unknown allergen codes", { missing });
  }

  return result.rows.map((row) => row.id);
};

const loadAdminCategory = async ({ dbClient, storeId, categoryId, languageCode, defaultLanguage }) => {
  const categoryResult = await dbClient.query(
    `
      select
        c.id,
        c.store_id,
        c.sort_order,
        c.is_active,
        coalesce(ct_req.name, ct_def.name, 'Untitled Category') as name,
        coalesce(ct_req.description, ct_def.description) as description
      from menu_categories c
      left join menu_category_translations ct_req
        on ct_req.category_id = c.id and ct_req.language_code = $3
      left join menu_category_translations ct_def
        on ct_def.category_id = c.id and ct_def.language_code = $4
      where c.store_id = $1 and c.id = $2
      limit 1
    `,
    [storeId, categoryId, languageCode, defaultLanguage],
  );

  if (categoryResult.rowCount === 0) {
    throw new HttpError(404, "Category not found");
  }

  const row = categoryResult.rows[0];
  return {
    id: row.id,
    storeId: row.store_id,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    name: row.name,
    description: row.description,
    languageCode,
  };
};

const loadAdminItem = async ({ dbClient, storeId, itemId, languageCode, defaultLanguage }) => {
  const itemResult = await dbClient.query(
    `
      select
        i.id,
        i.store_id,
        i.category_id,
        i.image_url,
        i.price_minor,
        i.currency_code,
        i.sort_order,
        i.is_active,
        i.is_available,
        coalesce(it_req.name, it_def.name, 'Untitled Item') as name,
        coalesce(it_req.description, it_def.description, '') as description,
        coalesce(array_remove(array_agg(a.code order by a.code), null), '{}') as allergen_codes
      from menu_items i
      left join menu_item_translations it_req
        on it_req.item_id = i.id and it_req.language_code = $3
      left join menu_item_translations it_def
        on it_def.item_id = i.id and it_def.language_code = $4
      left join menu_item_allergens mia on mia.item_id = i.id
      left join allergens a on a.id = mia.allergen_id
      where i.store_id = $1 and i.id = $2
      group by
        i.id,
        i.store_id,
        i.category_id,
        i.image_url,
        i.price_minor,
        i.currency_code,
        i.sort_order,
        i.is_active,
        i.is_available,
        it_req.name,
        it_def.name,
        it_req.description,
        it_def.description
      limit 1
    `,
    [storeId, itemId, languageCode, defaultLanguage],
  );

  if (itemResult.rowCount === 0) {
    throw new HttpError(404, "Item not found");
  }

  const row = itemResult.rows[0];
  return {
    id: row.id,
    storeId: row.store_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    priceMinor: row.price_minor,
    currencyCode: row.currency_code,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isAvailable: row.is_available,
    allergenCodes: row.allergen_codes,
    languageCode,
  };
};

router.get(
  "/stores/:storeId/categories",
  requireStoreRole(readOnlyRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    const { lang } = languageQuerySchema.parse(req.query);

    const store = await getActiveStoreForAdmin({ query }, storeId);
    const languageCode = lang ?? store.default_language_code;

    const categoriesResult = await query(
      `
        select
          c.id,
          c.store_id,
          c.sort_order,
          c.is_active,
          coalesce(ct_req.name, ct_def.name, 'Untitled Category') as name,
          coalesce(ct_req.description, ct_def.description) as description
        from menu_categories c
        left join menu_category_translations ct_req
          on ct_req.category_id = c.id and ct_req.language_code = $2
        left join menu_category_translations ct_def
          on ct_def.category_id = c.id and ct_def.language_code = $3
        where c.store_id = $1
        order by c.sort_order asc, c.created_at asc
      `,
      [store.id, languageCode, store.default_language_code],
    );

    res.json({
      storeId: store.id,
      languageCode,
      categories: categoriesResult.rows.map((row) => ({
        id: row.id,
        storeId: row.store_id,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        name: row.name,
        description: row.description,
      })),
    });
  }),
);

router.post(
  "/stores/:storeId/categories",
  requireStoreRole(editRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    const payload = createCategorySchema.parse(req.body);

    const createdCategory = await withTransaction(async (client) => {
      const store = await getActiveStoreForAdmin(client, storeId);

      const categoryResult = await client.query(
        `
          insert into menu_categories (store_id, sort_order, is_active)
          values ($1, $2, $3)
          returning id
        `,
        [store.id, payload.sortOrder, payload.isActive],
      );

      const categoryId = categoryResult.rows[0].id;

      await client.query(
        `
          insert into menu_category_translations
            (category_id, language_code, name, description, translated_by)
          values
            ($1, $2, $3, $4, 'manual')
        `,
        [categoryId, store.default_language_code, payload.name, payload.description ?? null],
      );

      return loadAdminCategory({
        dbClient: client,
        storeId: store.id,
        categoryId,
        languageCode: store.default_language_code,
        defaultLanguage: store.default_language_code,
      });
    });

    res.status(201).json(createdCategory);
  }),
);

router.put(
  "/stores/:storeId/categories/:categoryId",
  requireStoreRole(editRoles),
  asyncHandler(async (req, res) => {
    const { storeId, categoryId } = categoryParamsSchema.parse(req.params);
    const payload = updateCategorySchema.parse(req.body);

    const hasUpdate =
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.sortOrder !== undefined ||
      payload.isActive !== undefined ||
      payload.languageCode !== undefined;

    if (!hasUpdate) {
      throw new HttpError(400, "No update fields provided");
    }

    const updatedCategory = await withTransaction(async (client) => {
      const store = await getActiveStoreForAdmin(client, storeId);
      const languageCode = payload.languageCode ?? store.default_language_code;

      const categoryUpdateResult = await client.query(
        `
          update menu_categories
          set
            sort_order = coalesce($3, sort_order),
            is_active = coalesce($4, is_active)
          where id = $1 and store_id = $2
          returning id
        `,
        [categoryId, store.id, payload.sortOrder ?? null, payload.isActive ?? null],
      );

      if (categoryUpdateResult.rowCount === 0) {
        throw new HttpError(404, "Category not found");
      }

      if (payload.name !== undefined || payload.description !== undefined) {
        const currentTranslationResult = await client.query(
          `
            select name, description
            from menu_category_translations
            where category_id = $1 and language_code = $2
            limit 1
          `,
          [categoryId, languageCode],
        );

        const currentTranslation = currentTranslationResult.rows[0];
        const nextName = payload.name ?? currentTranslation?.name;
        if (!nextName) {
          throw new HttpError(400, "Category name is required to create new language translation");
        }

        const nextDescription =
          payload.description !== undefined
            ? payload.description
            : (currentTranslation?.description ?? null);

        await client.query(
          `
            insert into menu_category_translations
              (category_id, language_code, name, description, translated_by)
            values
              ($1, $2, $3, $4, 'manual')
            on conflict (category_id, language_code)
            do update set
              name = excluded.name,
              description = excluded.description,
              translated_by = 'manual',
              updated_at = now()
          `,
          [categoryId, languageCode, nextName, nextDescription],
        );
      }

      return loadAdminCategory({
        dbClient: client,
        storeId: store.id,
        categoryId,
        languageCode,
        defaultLanguage: store.default_language_code,
      });
    });

    res.json(updatedCategory);
  }),
);

router.delete(
  "/stores/:storeId/categories/:categoryId",
  requireStoreRole(manageRoles),
  asyncHandler(async (req, res) => {
    const { storeId, categoryId } = categoryParamsSchema.parse(req.params);
    await getActiveStoreForAdmin({ query }, storeId);

    const deleteResult = await query(
      `
        delete from menu_categories
        where id = $1 and store_id = $2
      `,
      [categoryId, storeId],
    );

    if (deleteResult.rowCount === 0) {
      throw new HttpError(404, "Category not found");
    }

    res.status(204).send();
  }),
);

router.get(
  "/stores/:storeId/items",
  requireStoreRole(readOnlyRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    const { lang } = languageQuerySchema.parse(req.query);

    const store = await getActiveStoreForAdmin({ query }, storeId);
    const languageCode = lang ?? store.default_language_code;

    const itemsResult = await query(
      `
        select
          i.id,
          i.store_id,
          i.category_id,
          i.image_url,
          i.price_minor,
          i.currency_code,
          i.sort_order,
          i.is_active,
          i.is_available,
          coalesce(it_req.name, it_def.name, 'Untitled Item') as name,
          coalesce(it_req.description, it_def.description, '') as description,
          coalesce(array_remove(array_agg(a.code order by a.code), null), '{}') as allergen_codes
        from menu_items i
        left join menu_item_translations it_req
          on it_req.item_id = i.id and it_req.language_code = $2
        left join menu_item_translations it_def
          on it_def.item_id = i.id and it_def.language_code = $3
        left join menu_item_allergens mia on mia.item_id = i.id
        left join allergens a on a.id = mia.allergen_id
        where i.store_id = $1
        group by
          i.id,
          i.store_id,
          i.category_id,
          i.image_url,
          i.price_minor,
          i.currency_code,
          i.sort_order,
          i.is_active,
          i.is_available,
          it_req.name,
          it_def.name,
          it_req.description,
          it_def.description
        order by i.sort_order asc, i.created_at asc
      `,
      [store.id, languageCode, store.default_language_code],
    );

    res.json({
      storeId: store.id,
      languageCode,
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        storeId: row.store_id,
        categoryId: row.category_id,
        name: row.name,
        description: row.description,
        imageUrl: row.image_url,
        priceMinor: row.price_minor,
        currencyCode: row.currency_code,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        isAvailable: row.is_available,
        allergenCodes: row.allergen_codes,
      })),
    });
  }),
);

router.post(
  "/stores/:storeId/items",
  requireStoreRole(editRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    const payload = createItemSchema.parse(req.body);

    const createdItem = await withTransaction(async (client) => {
      const store = await getActiveStoreForAdmin(client, storeId);
      await ensureCategoryBelongsStore(client, payload.categoryId, store.id);

      const itemResult = await client.query(
        `
          insert into menu_items
            (store_id, category_id, image_url, price_minor, currency_code, sort_order, is_active, is_available)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8)
          returning id
        `,
        [
          store.id,
          payload.categoryId,
          payload.imageUrl ?? null,
          payload.priceMinor,
          payload.currencyCode ?? store.default_currency_code,
          payload.sortOrder,
          payload.isActive,
          payload.isAvailable,
        ],
      );

      const itemId = itemResult.rows[0].id;

      await client.query(
        `
          insert into menu_item_translations
            (item_id, language_code, name, description, translated_by)
          values
            ($1, $2, $3, $4, 'manual')
        `,
        [itemId, store.default_language_code, payload.name, payload.description ?? null],
      );

      const allergenIds = await resolveAllergenIds(client, payload.allergenCodes);
      if (allergenIds.length > 0) {
        await client.query(
          `
            insert into menu_item_allergens (item_id, allergen_id)
            select $1, unnest($2::uuid[])
          `,
          [itemId, allergenIds],
        );
      }

      return loadAdminItem({
        dbClient: client,
        storeId: store.id,
        itemId,
        languageCode: store.default_language_code,
        defaultLanguage: store.default_language_code,
      });
    });

    res.status(201).json(createdItem);
  }),
);

router.put(
  "/stores/:storeId/items/:itemId",
  requireStoreRole(editRoles),
  asyncHandler(async (req, res) => {
    const { storeId, itemId } = itemParamsSchema.parse(req.params);
    const payload = updateItemSchema.parse(req.body);

    const hasUpdate =
      payload.categoryId !== undefined ||
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.priceMinor !== undefined ||
      payload.currencyCode !== undefined ||
      payload.imageUrl !== undefined ||
      payload.sortOrder !== undefined ||
      payload.isActive !== undefined ||
      payload.isAvailable !== undefined ||
      payload.languageCode !== undefined ||
      payload.allergenCodes !== undefined;

    if (!hasUpdate) {
      throw new HttpError(400, "No update fields provided");
    }

    const updatedItem = await withTransaction(async (client) => {
      const store = await getActiveStoreForAdmin(client, storeId);
      const translationLanguage = payload.languageCode ?? store.default_language_code;

      if (payload.categoryId !== undefined) {
        await ensureCategoryBelongsStore(client, payload.categoryId, store.id);
      }

      const itemExistsResult = await client.query(
        `
          select id
          from menu_items
          where id = $1 and store_id = $2
          limit 1
        `,
        [itemId, store.id],
      );

      if (itemExistsResult.rowCount === 0) {
        throw new HttpError(404, "Item not found");
      }

      const updateFragments = [];
      const updateValues = [];

      const appendUpdate = (column, value) => {
        updateValues.push(value);
        updateFragments.push(`${column} = $${updateValues.length}`);
      };

      if (payload.categoryId !== undefined) appendUpdate("category_id", payload.categoryId);
      if (payload.imageUrl !== undefined) appendUpdate("image_url", payload.imageUrl);
      if (payload.priceMinor !== undefined) appendUpdate("price_minor", payload.priceMinor);
      if (payload.currencyCode !== undefined) appendUpdate("currency_code", payload.currencyCode);
      if (payload.sortOrder !== undefined) appendUpdate("sort_order", payload.sortOrder);
      if (payload.isActive !== undefined) appendUpdate("is_active", payload.isActive);
      if (payload.isAvailable !== undefined) appendUpdate("is_available", payload.isAvailable);

      if (updateFragments.length > 0) {
        updateValues.push(itemId, store.id);
        const itemUpdateResult = await client.query(
          `
            update menu_items
            set ${updateFragments.join(", ")}
            where id = $${updateValues.length - 1} and store_id = $${updateValues.length}
            returning id
          `,
          updateValues,
        );

        if (itemUpdateResult.rowCount === 0) {
          throw new HttpError(404, "Item not found");
        }
      }

      if (payload.name !== undefined || payload.description !== undefined) {
        const currentTranslationResult = await client.query(
          `
            select name, description
            from menu_item_translations
            where item_id = $1 and language_code = $2
            limit 1
          `,
          [itemId, translationLanguage],
        );

        const currentTranslation = currentTranslationResult.rows[0];
        const nextName = payload.name ?? currentTranslation?.name;
        if (!nextName) {
          throw new HttpError(400, "Item name is required to create new language translation");
        }

        const nextDescription =
          payload.description !== undefined
            ? payload.description
            : (currentTranslation?.description ?? null);

        await client.query(
          `
            insert into menu_item_translations
              (item_id, language_code, name, description, translated_by)
            values
              ($1, $2, $3, $4, 'manual')
            on conflict (item_id, language_code)
            do update set
              name = excluded.name,
              description = excluded.description,
              translated_by = 'manual',
              updated_at = now()
          `,
          [itemId, translationLanguage, nextName, nextDescription],
        );
      }

      if (payload.allergenCodes !== undefined) {
        const allergenIds = await resolveAllergenIds(client, payload.allergenCodes);
        await client.query(
          `
            delete from menu_item_allergens
            where item_id = $1
          `,
          [itemId],
        );

        if (allergenIds.length > 0) {
          await client.query(
            `
              insert into menu_item_allergens (item_id, allergen_id)
              select $1, unnest($2::uuid[])
            `,
            [itemId, allergenIds],
          );
        }
      }

      return loadAdminItem({
        dbClient: client,
        storeId: store.id,
        itemId,
        languageCode: translationLanguage,
        defaultLanguage: store.default_language_code,
      });
    });

    res.json(updatedItem);
  }),
);

router.delete(
  "/stores/:storeId/items/:itemId",
  requireStoreRole(manageRoles),
  asyncHandler(async (req, res) => {
    const { storeId, itemId } = itemParamsSchema.parse(req.params);
    await getActiveStoreForAdmin({ query }, storeId);

    const deleteResult = await query(
      `
        delete from menu_items
        where id = $1 and store_id = $2
      `,
      [itemId, storeId],
    );

    if (deleteResult.rowCount === 0) {
      throw new HttpError(404, "Item not found");
    }

    res.status(204).send();
  }),
);

export { router as adminRouter };
