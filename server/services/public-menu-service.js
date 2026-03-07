import { query, withTransaction } from "../db/pool.js";
import { config } from "../config.js";
import { HttpError } from "../utils/http-error.js";

const isSameLanguage = (left, right) => {
  if (!left || !right) return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  return a.split("-")[0] === b.split("-")[0];
};

const decodeHtmlEntities = (value) => {
  if (!value) return value;
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
};

const LANGUAGE_PRIORITY_ORDER = [
  "en-US",
  "zh-CN",
  "ja-JP",
  "ko-KR",
  "es-ES",
  "fr-FR",
  "de-DE",
  "ar-SA",
];

const toGoogleLanguageCode = (code) => {
  if (!code) return "";
  const normalized = String(code).trim();
  if (!normalized) return "";

  const lowered = normalized.toLowerCase();
  if (lowered === "zh-cn" || lowered === "zh-hans") return "zh-CN";
  if (lowered === "zh-tw" || lowered === "zh-hant") return "zh-TW";

  const base = lowered.split("-")[0];
  return base;
};

const translateTextsWithGoogle = async ({ texts, targetLanguage, sourceLanguage }) => {
  if (!texts.length) return [];

  if (config.googleTranslateApiKey) {
    const endpoint = new URL("https://translation.googleapis.com/language/translate/v2");
    endpoint.searchParams.set("key", config.googleTranslateApiKey);

    const response = await globalThis.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: texts,
        target: targetLanguage,
        source: sourceLanguage,
        format: "text",
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `Google Translate request failed (${response.status})`;
      throw new HttpError(502, message);
    }

    const translatedRows = payload?.data?.translations;
    if (!Array.isArray(translatedRows) || translatedRows.length !== texts.length) {
      throw new HttpError(502, "Unexpected Google Translate response");
    }

    return translatedRows.map((row) => decodeHtmlEntities(row?.translatedText ?? ""));
  }

  const translateOneByGoogleWeb = async (text) => {
    const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
    endpoint.searchParams.set("client", "gtx");
    endpoint.searchParams.set("sl", sourceLanguage || "auto");
    endpoint.searchParams.set("tl", targetLanguage);
    endpoint.searchParams.set("dt", "t");
    endpoint.searchParams.set("q", text);

    const response = await globalThis.fetch(endpoint);
    if (!response.ok) {
      throw new HttpError(502, `Google Translate web request failed (${response.status})`);
    }

    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
      throw new HttpError(502, "Unexpected Google Translate web response");
    }

    const chunks = payload[0]
      .map((entry) => (Array.isArray(entry) ? entry[0] : ""))
      .filter((entry) => typeof entry === "string");
    return decodeHtmlEntities(chunks.join(""));
  };

  const uniqueTexts = [...new Set(texts)];
  const translatedUnique = await Promise.all(uniqueTexts.map((text) => translateOneByGoogleWeb(text)));
  const translatedMap = new Map(uniqueTexts.map((text, index) => [text, translatedUnique[index]]));
  return texts.map((text) => translatedMap.get(text) ?? text);
};

const translatePublicMenuPayload = async (menuPayload, targetLanguage) => {
  const sourceLanguage = menuPayload.fallbackLanguage || menuPayload.lang;
  if (isSameLanguage(sourceLanguage, targetLanguage)) {
    return {
      ...menuPayload,
      lang: targetLanguage,
    };
  }

  const translated = structuredClone(menuPayload);
  const refs = [];

  const registerTextRef = (obj, key) => {
    if (!obj) return;
    const text = obj[key];
    if (typeof text !== "string") return;
    if (!text.trim()) return;
    refs.push({ obj, key, text });
  };

  registerTextRef(translated.store, "name");
  registerTextRef(translated.store, "address");

  for (const category of translated.categories ?? []) {
    registerTextRef(category, "name");
    for (const item of category.items ?? []) {
      registerTextRef(item, "name");
      registerTextRef(item, "description");
      if (Array.isArray(item.allergens)) {
        for (let index = 0; index < item.allergens.length; index += 1) {
          if (typeof item.allergens[index] !== "string") continue;
          if (!item.allergens[index].trim()) continue;
          refs.push({
            obj: item.allergens,
            key: index,
            text: item.allergens[index],
          });
        }
      }
    }
  }

  const translatedTexts = await translateTextsWithGoogle({
    texts: refs.map((entry) => entry.text),
    targetLanguage: toGoogleLanguageCode(targetLanguage),
    sourceLanguage: toGoogleLanguageCode(sourceLanguage),
  });

  refs.forEach((entry, index) => {
    entry.obj[entry.key] = translatedTexts[index];
  });

  translated.lang = targetLanguage;
  return translated;
};

export const getStoreLanguagesBySlug = async (storeSlug) => {
  const storeResult = await query(
    `
      select id, slug, default_language_code
      from stores
      where slug = $1 and is_active = true
      limit 1
    `,
    [storeSlug],
  );

  if (storeResult.rowCount === 0) {
    throw new HttpError(404, "Store not found");
  }

  const store = storeResult.rows[0];

  const languageResult = await query(
    `
      select
        l.code as code,
        l.english_name as english_name,
        l.native_name as native_name,
        case when l.code = $2 then true else false end as is_default
      from languages l
      left join store_languages sl
        on sl.language_code = l.code
        and sl.store_id = $1
      order by sl.is_default desc, sl.language_code asc
    `,
    [store.id, store.default_language_code],
  );

  const priorityRank = new Map(LANGUAGE_PRIORITY_ORDER.map((code, index) => [code, index]));
  const sortedRows = [...languageResult.rows].sort((a, b) => {
    if (a.code === store.default_language_code && b.code !== store.default_language_code) return -1;
    if (b.code === store.default_language_code && a.code !== store.default_language_code) return 1;
    const rankA = priorityRank.has(a.code) ? priorityRank.get(a.code) : 999;
    const rankB = priorityRank.has(b.code) ? priorityRank.get(b.code) : 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.code.localeCompare(b.code);
  });

  const topEightRows = sortedRows.slice(0, 8);

  return {
    storeSlug: store.slug,
    defaultLanguage: store.default_language_code,
    languages: topEightRows.map((row) => ({
      code: row.code,
      name: row.native_name,
      englishName: row.english_name,
      isDefault: row.is_default,
    })),
  };
};

export const getPublicMenuBySlug = async ({ storeSlug, requestedLanguage, dynamicTranslate = false }) => {
  const storeResult = await query(
    `
      select
        id,
        slug,
        brand_name,
        logo_url,
        default_language_code,
        default_currency_code,
        address_text,
        contact_phone
      from stores
      where slug = $1 and is_active = true
      limit 1
    `,
    [storeSlug],
  );

  if (storeResult.rowCount === 0) {
    throw new HttpError(404, "Store not found");
  }

  const store = storeResult.rows[0];
  const targetLanguage = requestedLanguage || store.default_language_code;
  const language = dynamicTranslate ? store.default_language_code : targetLanguage;

  const categoriesResult = await query(
    `
      select
        c.id,
        c.sort_order,
        coalesce(ct_req.name, ct_def.name, 'Untitled Category') as name
      from menu_categories c
      left join menu_category_translations ct_req
        on ct_req.category_id = c.id and ct_req.language_code = $2
      left join menu_category_translations ct_def
        on ct_def.category_id = c.id and ct_def.language_code = $3
      where c.store_id = $1 and c.is_active = true
      order by c.sort_order asc, c.created_at asc
    `,
    [store.id, language, store.default_language_code],
  );

  const itemsResult = await query(
    `
      select
        i.id,
        i.category_id,
        i.image_url,
        i.price_minor,
        i.currency_code,
        i.sort_order,
        coalesce(it_req.name, it_def.name, 'Untitled Item') as name,
        coalesce(it_req.description, it_def.description, '') as description
      from menu_items i
      left join menu_item_translations it_req
        on it_req.item_id = i.id and it_req.language_code = $2
      left join menu_item_translations it_def
        on it_def.item_id = i.id and it_def.language_code = $3
      where i.store_id = $1 and i.is_active = true and i.is_available = true
      order by i.sort_order asc, i.created_at asc
    `,
    [store.id, language, store.default_language_code],
  );

  const itemIds = itemsResult.rows.map((row) => row.id);
  let allergenRows = [];
  if (itemIds.length > 0) {
    const allergenResult = await query(
      `
        select
          mia.item_id,
          coalesce(at_req.label, at_def.label, a.code) as label
        from menu_item_allergens mia
        join allergens a on a.id = mia.allergen_id
        left join allergen_translations at_req
          on at_req.allergen_id = a.id and at_req.language_code = $2
        left join allergen_translations at_def
          on at_def.allergen_id = a.id and at_def.language_code = $3
        where mia.item_id = any($1::uuid[])
        order by mia.item_id, label
      `,
      [itemIds, language, store.default_language_code],
    );
    allergenRows = allergenResult.rows;
  }

  const allergensByItem = new Map();
  for (const row of allergenRows) {
    if (!allergensByItem.has(row.item_id)) {
      allergensByItem.set(row.item_id, []);
    }
    allergensByItem.get(row.item_id).push(row.label);
  }

  const categories = categoriesResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    items: [],
  }));

  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  for (const row of itemsResult.rows) {
    const category = categoryMap.get(row.category_id);
    if (!category) {
      continue;
    }

    category.items.push({
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      priceMinor: row.price_minor,
      currency: row.currency_code || store.default_currency_code,
      sortOrder: row.sort_order,
      allergens: allergensByItem.get(row.id) ?? [],
    });
  }

  const payload = {
    store: {
      id: store.id,
      slug: store.slug,
      name: store.brand_name,
      logoUrl: store.logo_url,
      address: store.address_text,
      phone: store.contact_phone,
    },
    lang: language,
    fallbackLanguage: store.default_language_code,
    categories,
  };

  if (dynamicTranslate) {
    return translatePublicMenuPayload(payload, targetLanguage);
  }

  return payload;
};

export const createPublicOrderBySlug = async ({ storeSlug, tableCode, note, items }) => {
  const orderResult = await withTransaction(async (client) => {
    const storeResult = await client.query(
      `
        select id, slug, default_language_code, default_currency_code
        from stores
        where slug = $1 and is_active = true
        limit 1
      `,
      [storeSlug],
    );

    if (storeResult.rowCount === 0) {
      throw new HttpError(404, "Store not found");
    }
    const store = storeResult.rows[0];

    const quantityByItemId = new Map();
    for (const line of items) {
      const current = quantityByItemId.get(line.menuItemId) ?? 0;
      quantityByItemId.set(line.menuItemId, current + line.quantity);
    }

    const menuItemIds = Array.from(quantityByItemId.keys());
    const menuItemsResult = await client.query(
      `
        select
          i.id,
          i.price_minor,
          i.currency_code,
          coalesce(it.name, 'Unnamed Item') as item_name
        from menu_items i
        left join menu_item_translations it
          on it.item_id = i.id and it.language_code = $2
        where i.store_id = $1
          and i.is_active = true
          and i.is_available = true
          and i.id = any($3::uuid[])
      `,
      [store.id, store.default_language_code, menuItemIds],
    );

    const availableItemMap = new Map(menuItemsResult.rows.map((row) => [row.id, row]));
    const missingItemIds = menuItemIds.filter((itemId) => !availableItemMap.has(itemId));
    if (missingItemIds.length > 0) {
      throw new HttpError(400, "Some items are unavailable", { missingItemIds });
    }

    const orderInsertResult = await client.query(
      `
        insert into orders (store_id, table_code, status, note)
        values ($1, $2, 'new', $3)
        returning id, store_id, table_code, status, created_at
      `,
      [store.id, tableCode || null, note || null],
    );
    const createdOrder = orderInsertResult.rows[0];

    const orderItems = [];
    for (const [menuItemId, quantity] of quantityByItemId.entries()) {
      const menuItem = availableItemMap.get(menuItemId);
      orderItems.push({
        menuItemId,
        itemNameSnapshot: menuItem.item_name,
        priceMinor: menuItem.price_minor,
        currencyCode: menuItem.currency_code || store.default_currency_code,
        quantity,
      });
    }

    let totalMinor = 0;
    for (const line of orderItems) {
      totalMinor += line.priceMinor * line.quantity;
    }

    for (const line of orderItems) {
      await client.query(
        `
          insert into order_items
            (order_id, menu_item_id, item_name_snapshot, price_minor, currency_code, quantity)
          values
            ($1, $2, $3, $4, $5, $6)
        `,
        [
          createdOrder.id,
          line.menuItemId,
          line.itemNameSnapshot,
          line.priceMinor,
          line.currencyCode,
          line.quantity,
        ],
      );
    }

    return {
      orderId: createdOrder.id,
      storeId: createdOrder.store_id,
      storeSlug: store.slug,
      tableCode: createdOrder.table_code,
      status: createdOrder.status,
      createdAt: createdOrder.created_at,
      totalMinor,
      currencyCode: orderItems[0]?.currencyCode ?? store.default_currency_code,
      items: orderItems,
    };
  });

  return orderResult;
};
