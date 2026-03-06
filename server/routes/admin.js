import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { query, withTransaction } from "../db/pool.js";
import { authenticateAdmin, requireStoreRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";
import { ensureCategoryBelongsStore, getActiveStoreForAdmin } from "../services/store-service.js";

const router = express.Router();
router.use(authenticateAdmin);

const uploadsDirectory = path.resolve(process.cwd(), "server", "uploads");
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDirectory),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const safeExtension = extension && extension.length <= 10 ? extension : ".jpg";
      callback(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, "Unsupported image type. Use jpeg/png/webp/gif."));
      return;
    }
    callback(null, true);
  },
});

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

const orderParamsSchema = z.object({
  storeId: z.string().uuid(),
  orderId: z.string().uuid(),
});

const languageQuerySchema = z.object({
  lang: z.string().min(2).max(10).optional(),
});

const orderedAllergenCodes = [
  "milk",
  "eggs",
  "peanuts",
  "tree_nuts",
  "gluten",
  "soy",
  "fish",
  "shellfish",
  "sesame",
];

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

const updateStoreProfileSchema = z.object({
  brandName: z.string().trim().min(1).max(160).optional(),
  logoUrl: z.string().url().nullable().optional(),
  addressText: z.string().trim().max(2000).nullable().optional(),
  contactPhone: z.string().trim().max(120).nullable().optional(),
  contactEmail: z.string().trim().email().max(320).nullable().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["accepted", "preparing", "ready"]),
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

const toAdminStoreProfile = (store) => ({
  id: store.id,
  slug: store.slug,
  legalName: store.legal_name,
  brandName: store.brand_name,
  logoUrl: store.logo_url,
  defaultLanguageCode: store.default_language_code,
  defaultCurrencyCode: store.default_currency_code,
  addressText: store.address_text,
  contactPhone: store.contact_phone,
  contactEmail: store.contact_email,
});

router.get(
  "/stores/:storeId/profile",
  requireStoreRole(readOnlyRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    const store = await getActiveStoreForAdmin({ query }, storeId);
    res.json(toAdminStoreProfile(store));
  }),
);

router.put(
  "/stores/:storeId/profile",
  requireStoreRole(editRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    const payload = updateStoreProfileSchema.parse(req.body);

    const hasUpdate =
      payload.brandName !== undefined ||
      payload.logoUrl !== undefined ||
      payload.addressText !== undefined ||
      payload.contactPhone !== undefined ||
      payload.contactEmail !== undefined;

    if (!hasUpdate) {
      throw new HttpError(400, "No update fields provided");
    }

    await getActiveStoreForAdmin({ query }, storeId);

    const updateFragments = [];
    const updateValues = [];
    const appendUpdate = (column, value) => {
      updateValues.push(value);
      updateFragments.push(`${column} = $${updateValues.length}`);
    };

    if (payload.brandName !== undefined) appendUpdate("brand_name", payload.brandName);
    if (payload.logoUrl !== undefined) appendUpdate("logo_url", payload.logoUrl);
    if (payload.addressText !== undefined) appendUpdate("address_text", payload.addressText);
    if (payload.contactPhone !== undefined) appendUpdate("contact_phone", payload.contactPhone);
    if (payload.contactEmail !== undefined) appendUpdate("contact_email", payload.contactEmail);

    updateValues.push(storeId);
    const updatedStoreResult = await query(
      `
        update stores
        set ${updateFragments.join(", ")}
        where id = $${updateValues.length}
        returning
          id,
          slug,
          legal_name,
          brand_name,
          logo_url,
          default_language_code,
          default_currency_code,
          address_text,
          contact_phone,
          contact_email
      `,
      updateValues,
    );

    if (updatedStoreResult.rowCount === 0) {
      throw new HttpError(404, "Store not found");
    }

    res.json(toAdminStoreProfile(updatedStoreResult.rows[0]));
  }),
);

router.get(
  "/stores/:storeId/allergens",
  requireStoreRole(readOnlyRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    const { lang } = languageQuerySchema.parse(req.query);

    const store = await getActiveStoreForAdmin({ query }, storeId);
    const languageCode = lang ?? store.default_language_code;

    const allergenResult = await query(
      `
        select
          a.code,
          coalesce(at_req.label, at_def.label, a.code) as label
        from allergens a
        left join allergen_translations at_req
          on at_req.allergen_id = a.id and at_req.language_code = $1
        left join allergen_translations at_def
          on at_def.allergen_id = a.id and at_def.language_code = $2
        order by
          case a.code
            when 'milk' then 1
            when 'eggs' then 2
            when 'peanuts' then 3
            when 'tree_nuts' then 4
            when 'gluten' then 5
            when 'soy' then 6
            when 'fish' then 7
            when 'shellfish' then 8
            when 'sesame' then 9
            else 999
          end,
          a.code
      `,
      [languageCode, store.default_language_code],
    );

    const rowsByCode = new Map(allergenResult.rows.map((row) => [row.code, row]));
    const mergedRows = [
      ...orderedAllergenCodes.map((code) => rowsByCode.get(code)).filter(Boolean),
      ...allergenResult.rows.filter((row) => !orderedAllergenCodes.includes(row.code)),
    ];

    res.json({
      languageCode,
      allergens: mergedRows.map((row) => ({
        code: row.code,
        label: row.label,
      })),
    });
  }),
);

router.post(
  "/stores/:storeId/uploads/image",
  requireStoreRole(editRoles),
  imageUpload.single("file"),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    await getActiveStoreForAdmin({ query }, storeId);

    if (!req.file) {
      throw new HttpError(400, "Image file is required.");
    }

    const imagePath = `/uploads/${req.file.filename}`;
    const host = req.get("host");
    const imageUrl = `${req.protocol}://${host}${imagePath}`;

    res.status(201).json({
      imageUrl,
      imagePath,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  }),
);

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

router.get(
  "/stores/:storeId/orders",
  requireStoreRole(readOnlyRoles),
  asyncHandler(async (req, res) => {
    const { storeId } = storeParamsSchema.parse(req.params);
    await getActiveStoreForAdmin({ query }, storeId);

    const ordersResult = await query(
      `
        select
          o.id,
          o.store_id,
          o.table_code,
          o.status,
          o.created_at,
          o.updated_at,
          coalesce(sum(oi.price_minor * oi.quantity), 0) as total_minor,
          coalesce(max(oi.currency_code), 'CNY') as currency_code,
          coalesce(
            json_agg(
              json_build_object(
                'id', oi.id,
                'menuItemId', oi.menu_item_id,
                'itemName', oi.item_name_snapshot,
                'priceMinor', oi.price_minor,
                'currencyCode', oi.currency_code,
                'quantity', oi.quantity
              )
              order by oi.id
            ) filter (where oi.id is not null),
            '[]'::json
          ) as items
        from orders o
        left join order_items oi on oi.order_id = o.id
        where o.store_id = $1
        group by o.id, o.store_id, o.table_code, o.status, o.created_at, o.updated_at
        order by o.created_at desc
      `,
      [storeId],
    );

    res.json({
      storeId,
      orders: ordersResult.rows.map((row) => ({
        id: row.id,
        storeId: row.store_id,
        tableCode: row.table_code,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        totalMinor: Number(row.total_minor ?? 0),
        currencyCode: row.currency_code,
        items: row.items ?? [],
      })),
    });
  }),
);

router.patch(
  "/stores/:storeId/orders/:orderId/status",
  requireStoreRole(editRoles),
  asyncHandler(async (req, res) => {
    const { storeId, orderId } = orderParamsSchema.parse(req.params);
    const payload = updateOrderStatusSchema.parse(req.body);
    await getActiveStoreForAdmin({ query }, storeId);

    const updateResult = await query(
      `
        update orders
        set status = $3, updated_at = now()
        where id = $1 and store_id = $2
        returning id, store_id, table_code, status, created_at, updated_at
      `,
      [orderId, storeId, payload.status],
    );

    if (updateResult.rowCount === 0) {
      throw new HttpError(404, "Order not found");
    }

    res.json({
      order: {
        id: updateResult.rows[0].id,
        storeId: updateResult.rows[0].store_id,
        tableCode: updateResult.rows[0].table_code,
        status: updateResult.rows[0].status,
        createdAt: updateResult.rows[0].created_at,
        updatedAt: updateResult.rows[0].updated_at,
      },
    });
  }),
);

router.delete(
  "/stores/:storeId/orders/:orderId",
  requireStoreRole(editRoles),
  asyncHandler(async (req, res) => {
    const { storeId, orderId } = orderParamsSchema.parse(req.params);
    await getActiveStoreForAdmin({ query }, storeId);

    const deleteResult = await query(
      `
        delete from orders
        where id = $1 and store_id = $2
      `,
      [orderId, storeId],
    );

    if (deleteResult.rowCount === 0) {
      throw new HttpError(404, "Order not found");
    }

    res.status(204).send();
  }),
);

export { router as adminRouter };
