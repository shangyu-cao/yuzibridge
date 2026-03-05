import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const DB_SSL = (process.env.DB_SSL ?? "false").toLowerCase() === "true";

const SEED_STORE_SLUG = process.env.SEED_STORE_SLUG ?? "dunwuzhai";
const SEED_STORE_BRAND_NAME = process.env.SEED_STORE_BRAND_NAME ?? "敦悟斋";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin+dunwuzhai@yuzibridge.com";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

const LANGUAGE_ROWS = [
  { code: "zh-CN", englishName: "Chinese (Simplified)", nativeName: "简体中文", isRtl: false },
  { code: "en-US", englishName: "English (US)", nativeName: "English (US)", isRtl: false },
  { code: "ja-JP", englishName: "Japanese", nativeName: "日本語", isRtl: false },
];

const STORE_LANGUAGE_ROWS = [
  { code: "zh-CN", isDefault: true, isEnabled: true },
  { code: "en-US", isDefault: false, isEnabled: true },
  { code: "ja-JP", isDefault: false, isEnabled: true },
];

const SOCIAL_LINKS = [
  { platform: "instagram", url: "https://instagram.com/dunwuzhai" },
  { platform: "xiaohongshu", url: "https://www.xiaohongshu.com/" },
];

const ALLERGENS = [
  {
    code: "milk",
    labels: { "zh-CN": "奶类", "en-US": "Milk", "ja-JP": "乳" },
  },
  {
    code: "eggs",
    labels: { "zh-CN": "蛋类", "en-US": "Eggs", "ja-JP": "卵" },
  },
  {
    code: "peanuts",
    labels: { "zh-CN": "花生", "en-US": "Peanuts", "ja-JP": "ピーナッツ" },
  },
  {
    code: "tree_nuts",
    labels: { "zh-CN": "树坚果", "en-US": "Tree Nuts", "ja-JP": "木の実" },
  },
  {
    code: "gluten",
    labels: { "zh-CN": "麸质", "en-US": "Gluten", "ja-JP": "小麦" },
  },
  {
    code: "soy",
    labels: { "zh-CN": "大豆", "en-US": "Soy", "ja-JP": "大豆" },
  },
  {
    code: "fish",
    labels: { "zh-CN": "鱼类", "en-US": "Fish", "ja-JP": "魚" },
  },
  {
    code: "shellfish",
    labels: { "zh-CN": "甲壳类", "en-US": "Shellfish", "ja-JP": "甲殻類" },
  },
  {
    code: "sesame",
    labels: { "zh-CN": "芝麻", "en-US": "Sesame", "ja-JP": "ごま" },
  },
];

const MENU_SEED = [
  {
    sortOrder: 10,
    translations: {
      "zh-CN": { name: "主厨推荐", description: "本店最受欢迎菜品" },
      "en-US": { name: "Chef's Specials", description: "Most popular dishes in this store" },
      "ja-JP": { name: "シェフおすすめ", description: "当店の人気メニュー" },
    },
    items: [
      {
        sku: "DUN-001",
        priceMinor: 5800,
        currencyCode: "CNY",
        sortOrder: 10,
        imageUrl: null,
        allergenCodes: ["gluten", "soy"],
        translations: {
          "zh-CN": { name: "招牌牛肉面", description: "慢炖牛腩与手工面，汤底浓郁。" },
          "en-US": { name: "Signature Beef Noodles", description: "Slow-braised beef brisket with handmade noodles." },
          "ja-JP": { name: "特製牛肉麺", description: "じっくり煮込んだ牛バラ肉と手打ち麺。" },
        },
      },
      {
        sku: "DUN-002",
        priceMinor: 4800,
        currencyCode: "CNY",
        sortOrder: 20,
        imageUrl: null,
        allergenCodes: ["eggs", "soy"],
        translations: {
          "zh-CN": { name: "黑松露炒饭", description: "鸡蛋炒饭搭配黑松露酱和时蔬。" },
          "en-US": { name: "Truffle Fried Rice", description: "Egg fried rice with truffle paste and vegetables." },
          "ja-JP": { name: "トリュフチャーハン", description: "卵チャーハンにトリュフソースと野菜を合わせました。" },
        },
      },
    ],
  },
  {
    sortOrder: 20,
    translations: {
      "zh-CN": { name: "小食", description: "轻食与前菜" },
      "en-US": { name: "Small Plates", description: "Snacks and appetizers" },
      "ja-JP": { name: "前菜", description: "軽食と前菜" },
    },
    items: [
      {
        sku: "DUN-003",
        priceMinor: 3200,
        currencyCode: "CNY",
        sortOrder: 10,
        imageUrl: null,
        allergenCodes: ["shellfish", "gluten"],
        translations: {
          "zh-CN": { name: "鲜虾春卷", description: "酥脆外皮包裹虾仁与蔬菜。" },
          "en-US": { name: "Shrimp Spring Rolls", description: "Crispy spring rolls with shrimp and vegetables." },
          "ja-JP": { name: "海老春巻き", description: "海老と野菜を包んだサクサク春巻き。" },
        },
      },
      {
        sku: "DUN-004",
        priceMinor: 2600,
        currencyCode: "CNY",
        sortOrder: 20,
        imageUrl: null,
        allergenCodes: ["soy", "sesame"],
        translations: {
          "zh-CN": { name: "凉拌豆腐", description: "嫩豆腐配芝麻酱与海苔碎。" },
          "en-US": { name: "Cold Tofu Salad", description: "Silken tofu with sesame dressing and nori flakes." },
          "ja-JP": { name: "冷奴サラダ", description: "絹ごし豆腐にごまドレッシングと海苔。" },
        },
      },
    ],
  },
  {
    sortOrder: 30,
    translations: {
      "zh-CN": { name: "饮品", description: "推荐饮料" },
      "en-US": { name: "Drinks", description: "House beverages" },
      "ja-JP": { name: "ドリンク", description: "おすすめドリンク" },
    },
    items: [
      {
        sku: "DUN-005",
        priceMinor: 2200,
        currencyCode: "CNY",
        sortOrder: 10,
        imageUrl: null,
        allergenCodes: [],
        translations: {
          "zh-CN": { name: "柚子气泡饮", description: "新鲜柚子汁与苏打水。" },
          "en-US": { name: "Yuzu Sparkling", description: "Fresh yuzu juice with sparkling water." },
          "ja-JP": { name: "柚子スパークリング", description: "生搾り柚子ジュースと炭酸水。" },
        },
      },
    ],
  },
];

const ensureDatabaseUrl = () => {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Please set it in .env before running seed.");
  }
};

const upsertLanguages = async (client) => {
  for (const language of LANGUAGE_ROWS) {
    await client.query(
      `
        insert into languages (code, english_name, native_name, is_rtl)
        values ($1, $2, $3, $4)
        on conflict (code)
        do update set
          english_name = excluded.english_name,
          native_name = excluded.native_name,
          is_rtl = excluded.is_rtl
      `,
      [language.code, language.englishName, language.nativeName, language.isRtl],
    );
  }
};

const upsertStore = async (client) => {
  const storeResult = await client.query(
    `
      insert into stores
        (slug, legal_name, brand_name, logo_url, default_language_code, default_currency_code, timezone, address_text, contact_phone, contact_email, is_active)
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      on conflict (slug)
      do update set
        legal_name = excluded.legal_name,
        brand_name = excluded.brand_name,
        logo_url = excluded.logo_url,
        default_language_code = excluded.default_language_code,
        default_currency_code = excluded.default_currency_code,
        timezone = excluded.timezone,
        address_text = excluded.address_text,
        contact_phone = excluded.contact_phone,
        contact_email = excluded.contact_email,
        is_active = true,
        updated_at = now()
      returning id, slug, brand_name, default_language_code, default_currency_code
    `,
    [
      SEED_STORE_SLUG,
      "Dunwuzhai Catering Co., Ltd.",
      SEED_STORE_BRAND_NAME,
      null,
      "zh-CN",
      "CNY",
      "Asia/Shanghai",
      "上海市静安区示例路 88 号",
      "+86 21 5555 8888",
      "hello@dunwuzhai.com",
    ],
  );

  return storeResult.rows[0];
};

const upsertStoreLanguages = async (client, storeId) => {
  await client.query(
    `
      update store_languages
      set is_default = false
      where store_id = $1
    `,
    [storeId],
  );

  for (const languageRow of STORE_LANGUAGE_ROWS) {
    await client.query(
      `
        insert into store_languages (store_id, language_code, is_default, is_enabled)
        values ($1, $2, $3, $4)
        on conflict (store_id, language_code)
        do update set
          is_default = excluded.is_default,
          is_enabled = excluded.is_enabled
      `,
      [storeId, languageRow.code, languageRow.isDefault, languageRow.isEnabled],
    );
  }
};

const upsertStoreSocialLinks = async (client, storeId) => {
  await client.query(
    `
      delete from store_social_links
      where store_id = $1
    `,
    [storeId],
  );

  for (const [index, link] of SOCIAL_LINKS.entries()) {
    await client.query(
      `
        insert into store_social_links (store_id, platform, url, sort_order)
        values ($1, $2, $3, $4)
      `,
      [storeId, link.platform, link.url, index + 1],
    );
  }
};

const upsertAdminUser = async (client) => {
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);

  const userResult = await client.query(
    `
      insert into users
        (email, password_hash, display_name, is_platform_admin, is_active)
      values
        ($1, $2, $3, false, true)
      on conflict (email)
      do update set
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now()
      returning id, email
    `,
    [SEED_ADMIN_EMAIL, passwordHash, "Dunwuzhai Admin"],
  );

  return userResult.rows[0];
};

const upsertStoreMembership = async (client, storeId, userId) => {
  await client.query(
    `
      insert into store_memberships (store_id, user_id, role)
      values ($1, $2, 'owner')
      on conflict (store_id, user_id)
      do update set role = 'owner'
    `,
    [storeId, userId],
  );
};

const upsertAllergens = async (client) => {
  const allergenIdMap = new Map();

  for (const allergen of ALLERGENS) {
    const allergenResult = await client.query(
      `
        insert into allergens (code, icon_url)
        values ($1, $2)
        on conflict (code)
        do update set icon_url = excluded.icon_url
        returning id, code
      `,
      [allergen.code, null],
    );

    const row = allergenResult.rows[0];
    allergenIdMap.set(row.code, row.id);

    for (const language of LANGUAGE_ROWS) {
      const label = allergen.labels[language.code];
      if (!label) {
        continue;
      }

      await client.query(
        `
          insert into allergen_translations (allergen_id, language_code, label)
          values ($1, $2, $3)
          on conflict (allergen_id, language_code)
          do update set label = excluded.label
        `,
        [row.id, language.code, label],
      );
    }
  }

  return allergenIdMap;
};

const resetStoreMenu = async (client, storeId) => {
  await client.query(
    `
      delete from menu_items
      where store_id = $1
    `,
    [storeId],
  );

  await client.query(
    `
      delete from menu_categories
      where store_id = $1
    `,
    [storeId],
  );
};

const insertSeedMenu = async (client, { store, allergenIdMap }) => {
  let categoryCount = 0;
  let itemCount = 0;

  for (const categorySeed of MENU_SEED) {
    const categoryResult = await client.query(
      `
        insert into menu_categories
          (store_id, sort_order, is_active)
        values
          ($1, $2, true)
        returning id
      `,
      [store.id, categorySeed.sortOrder],
    );

    const categoryId = categoryResult.rows[0].id;
    categoryCount += 1;

    for (const language of LANGUAGE_ROWS) {
      const translation = categorySeed.translations[language.code];
      if (!translation) {
        continue;
      }

      await client.query(
        `
          insert into menu_category_translations
            (category_id, language_code, name, description, translated_by)
          values
            ($1, $2, $3, $4, 'manual')
        `,
        [categoryId, language.code, translation.name, translation.description ?? null],
      );
    }

    for (const itemSeed of categorySeed.items) {
      const itemResult = await client.query(
        `
          insert into menu_items
            (store_id, category_id, sku, image_url, price_minor, currency_code, sort_order, is_active, is_available)
          values
            ($1, $2, $3, $4, $5, $6, $7, true, true)
          returning id
        `,
        [
          store.id,
          categoryId,
          itemSeed.sku,
          itemSeed.imageUrl,
          itemSeed.priceMinor,
          itemSeed.currencyCode ?? store.default_currency_code,
          itemSeed.sortOrder,
        ],
      );

      const itemId = itemResult.rows[0].id;
      itemCount += 1;

      for (const language of LANGUAGE_ROWS) {
        const translation = itemSeed.translations[language.code];
        if (!translation) {
          continue;
        }

        await client.query(
          `
            insert into menu_item_translations
              (item_id, language_code, name, description, translated_by)
            values
              ($1, $2, $3, $4, 'manual')
          `,
          [itemId, language.code, translation.name, translation.description ?? null],
        );
      }

      for (const allergenCode of itemSeed.allergenCodes) {
        const allergenId = allergenIdMap.get(allergenCode);
        if (!allergenId) {
          continue;
        }

        await client.query(
          `
            insert into menu_item_allergens (item_id, allergen_id)
            values ($1, $2)
            on conflict (item_id, allergen_id) do nothing
          `,
          [itemId, allergenId],
        );
      }
    }
  }

  return { categoryCount, itemCount };
};

const upsertStoreQr = async (client, storeSlug, storeId) => {
  const targetUrl = `https://www.yuzibridge.com/menu/${storeSlug}`;
  await client.query(
    `
      insert into store_qr_codes (store_id, table_code, target_url, qr_image_url)
      values ($1, null, $2, null)
      on conflict (store_id, table_code)
      do update set
        target_url = excluded.target_url,
        qr_image_url = excluded.qr_image_url
    `,
    [storeId, targetUrl],
  );
};

const run = async () => {
  ensureDatabaseUrl();

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    await client.query("begin");

    await upsertLanguages(client);

    const store = await upsertStore(client);
    await upsertStoreLanguages(client, store.id);
    await upsertStoreSocialLinks(client, store.id);

    const adminUser = await upsertAdminUser(client);
    await upsertStoreMembership(client, store.id, adminUser.id);

    const allergenIdMap = await upsertAllergens(client);
    await resetStoreMenu(client, store.id);
    const { categoryCount, itemCount } = await insertSeedMenu(client, { store, allergenIdMap });
    await upsertStoreQr(client, store.slug, store.id);

    await client.query("commit");

    const defaultPasswordNotice =
      SEED_ADMIN_PASSWORD === "ChangeMe123!"
        ? " (using default password; change immediately)"
        : "";

    console.log("[seed] done");
    console.log(`[seed] store: ${store.brand_name} (${store.slug})`);
    console.log(`[seed] store_id: ${store.id}`);
    console.log(`[seed] categories: ${categoryCount}, items: ${itemCount}`);
    console.log(`[seed] admin_email: ${adminUser.email}`);
    console.log(`[seed] admin_password: ${SEED_ADMIN_PASSWORD}${defaultPasswordNotice}`);
    console.log(`[seed] qr target: https://www.yuzibridge.com/menu/${store.slug}`);
  } catch (error) {
    await client.query("rollback");
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
