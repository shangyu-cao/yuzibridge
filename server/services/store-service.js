import { HttpError } from "../utils/http-error.js";

export const getActiveStoreForAdmin = async (dbClient, storeId) => {
  const result = await dbClient.query(
    `
      select
        id,
        slug,
        legal_name,
        brand_name,
        logo_url,
        default_language_code,
        default_currency_code,
        address_text,
        contact_phone,
        contact_email,
        is_active
      from stores
      where id = $1
      limit 1
    `,
    [storeId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "Store not found");
  }

  const store = result.rows[0];
  if (!store.is_active) {
    throw new HttpError(400, "Store is inactive");
  }

  return store;
};

export const ensureCategoryBelongsStore = async (dbClient, categoryId, storeId) => {
  const result = await dbClient.query(
    `
      select id
      from menu_categories
      where id = $1 and store_id = $2
      limit 1
    `,
    [categoryId, storeId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "Category not found for this store");
  }
};
