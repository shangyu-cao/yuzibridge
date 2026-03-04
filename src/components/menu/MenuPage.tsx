import React, { useEffect, useMemo, useState } from "react";
import CategorySidebar from "./category/CategorySidebar";
import MenuItemCard from "./item/MenuItemCard";
import MenuFooter, { type SocialLink } from "./layout/MenuFooter";
import MenuHeader, { type LanguageOption } from "./layout/MenuHeader";
import "./menu.css";

type PublicLanguageResponse = {
  storeSlug: string;
  defaultLanguage: string;
  languages: Array<{
    code: string;
    name: string;
    englishName: string;
    isDefault: boolean;
  }>;
};

type PublicMenuResponse = {
  store: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    socialLinks: Array<{ platform: string; url: string }>;
  };
  lang: string;
  fallbackLanguage: string;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{
      id: string;
      name: string;
      description: string;
      imageUrl?: string | null;
      priceMinor: number;
      currency: string;
      sortOrder: number;
      allergens: string[];
    }>;
  }>;
};

type MenuPageProps = {
  storeSlug: string;
};

type UiCopy = {
  categoryTitle: string;
  noItemsText: string;
  loadingText: string;
  errorText: string;
  fallbackText: string;
  retryText: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const FALLBACK_LANGUAGES: LanguageOption[] = [
  { code: "zh-CN", label: "Chinese", nativeLabel: "简体中文" },
  { code: "en-US", label: "English", nativeLabel: "English" },
  { code: "ja-JP", label: "Japanese", nativeLabel: "日本語" },
];

const UI_COPY: Record<string, UiCopy> = {
  "zh-CN": {
    categoryTitle: "分类",
    noItemsText: "该分类暂无菜品。",
    loadingText: "正在加载菜单...",
    errorText: "菜单数据加载失败",
    fallbackText: "当前显示演示数据，请检查后端服务和数据库连接。",
    retryText: "重试",
  },
  "en-US": {
    categoryTitle: "Categories",
    noItemsText: "No dishes in this category yet.",
    loadingText: "Loading menu...",
    errorText: "Failed to load menu data",
    fallbackText: "Showing demo data. Please check backend service and database connection.",
    retryText: "Retry",
  },
  "ja-JP": {
    categoryTitle: "カテゴリ",
    noItemsText: "このカテゴリには料理がありません。",
    loadingText: "メニューを読み込み中...",
    errorText: "メニューデータの読み込みに失敗しました",
    fallbackText: "現在はデモデータを表示しています。バックエンドとDB接続を確認してください。",
    retryText: "再試行",
  },
};

const DEMO_MENU: PublicMenuResponse = {
  store: {
    id: "demo-store",
    slug: "dunwuzhai",
    name: "敦悟斋（Demo）",
    logoUrl: null,
    address: "上海市静安区示例路 88 号",
    phone: "+86 21 5555 8888",
    email: "hello@dunwuzhai.com",
    socialLinks: [
      { platform: "instagram", url: "https://instagram.com" },
      { platform: "xiaohongshu", url: "https://www.xiaohongshu.com/" },
    ],
  },
  lang: "zh-CN",
  fallbackLanguage: "zh-CN",
  categories: [
    {
      id: "demo-cat-1",
      name: "主厨推荐",
      sortOrder: 10,
      items: [
        {
          id: "demo-item-1",
          name: "招牌牛肉面",
          description: "慢炖牛腩与手工面，汤底浓郁。",
          imageUrl: null,
          priceMinor: 5800,
          currency: "CNY",
          sortOrder: 10,
          allergens: ["麸质", "大豆"],
        },
        {
          id: "demo-item-2",
          name: "黑松露炒饭",
          description: "鸡蛋炒饭搭配黑松露酱和时蔬。",
          imageUrl: null,
          priceMinor: 4800,
          currency: "CNY",
          sortOrder: 20,
          allergens: ["蛋", "大豆"],
        },
      ],
    },
    {
      id: "demo-cat-2",
      name: "饮品",
      sortOrder: 20,
      items: [
        {
          id: "demo-item-3",
          name: "柚子气泡饮",
          description: "新鲜柚子汁与苏打水。",
          imageUrl: null,
          priceMinor: 2200,
          currency: "CNY",
          sortOrder: 10,
          allergens: [],
        },
      ],
    },
  ],
};

const titleCase = (value: string) =>
  value
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getUiCopy = (languageCode: string): UiCopy => {
  if (languageCode.startsWith("zh")) {
    return UI_COPY["zh-CN"];
  }
  if (languageCode.startsWith("ja")) {
    return UI_COPY["ja-JP"];
  }
  return UI_COPY["en-US"];
};

const fetchJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
};

const toLanguageOptions = (payload: PublicLanguageResponse): LanguageOption[] => {
  if (!payload.languages.length) {
    return FALLBACK_LANGUAGES;
  }

  return payload.languages.map((language) => ({
    code: language.code,
    label: language.englishName,
    nativeLabel: language.name,
  }));
};

const toSocialLinks = (links: Array<{ platform: string; url: string }>): SocialLink[] => {
  return links.map((link) => ({
    label: titleCase(link.platform),
    url: link.url,
  }));
};

const MenuPage: React.FC<MenuPageProps> = ({ storeSlug }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("zh-CN");
  const [languages, setLanguages] = useState<LanguageOption[]>(FALLBACK_LANGUAGES);
  const [menuPayload, setMenuPayload] = useState<PublicMenuResponse | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let ignore = false;

    const loadLanguages = async () => {
      try {
        const payload = await fetchJson<PublicLanguageResponse>(
          `/api/public/stores/${encodeURIComponent(storeSlug)}/languages`,
        );

        if (ignore) {
          return;
        }

        const options = toLanguageOptions(payload);
        setLanguages(options);

        const defaultOption = options.find((option) => option.code === payload.defaultLanguage);
        setSelectedLanguage(defaultOption?.code ?? options[0]?.code ?? "zh-CN");
      } catch (_error) {
        if (ignore) {
          return;
        }

        setLanguages(FALLBACK_LANGUAGES);
        setSelectedLanguage("zh-CN");
      }
    };

    loadLanguages();

    return () => {
      ignore = true;
    };
  }, [storeSlug]);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setErrorMessage("");
    setUsingFallback(false);

    const loadMenu = async () => {
      try {
        const payload = await fetchJson<PublicMenuResponse>(
          `/api/public/stores/${encodeURIComponent(storeSlug)}/menu?lang=${encodeURIComponent(
            selectedLanguage,
          )}`,
        );

        if (ignore) {
          return;
        }

        setMenuPayload(payload);
      } catch (_error) {
        if (ignore) {
          return;
        }

        setMenuPayload({
          ...DEMO_MENU,
          store: {
            ...DEMO_MENU.store,
            slug: storeSlug,
          },
          lang: selectedLanguage,
        });
        setErrorMessage(getUiCopy(selectedLanguage).errorText);
        setUsingFallback(true);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    if (selectedLanguage) {
      loadMenu();
    }

    return () => {
      ignore = true;
    };
  }, [storeSlug, selectedLanguage, retryToken]);

  const uiCopy = getUiCopy(selectedLanguage);

  const categories = useMemo(
    () =>
      (menuPayload?.categories ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        itemCount: category.items.length,
      })),
    [menuPayload],
  );

  useEffect(() => {
    const categoryExists = categories.some((category) => category.id === activeCategoryId);
    if (!categoryExists) {
      setActiveCategoryId(categories[0]?.id ?? "");
    }
  }, [activeCategoryId, categories]);

  const activeCategory = useMemo(() => {
    if (!menuPayload?.categories.length) {
      return undefined;
    }

    return (
      menuPayload.categories.find((category) => category.id === activeCategoryId) ??
      menuPayload.categories[0]
    );
  }, [activeCategoryId, menuPayload]);

  const storeName = menuPayload?.store.name ?? storeSlug;
  const socialLinks = toSocialLinks(menuPayload?.store.socialLinks ?? []);

  return (
    <div className="menu-page">
      <div className="menu-shell">
        <MenuHeader
          storeName={storeName}
          logoUrl={menuPayload?.store.logoUrl ?? undefined}
          selectedLanguage={selectedLanguage}
          languages={languages}
          onLanguageChange={setSelectedLanguage}
        />

        <main className="menu-main">
          <CategorySidebar
            title={uiCopy.categoryTitle}
            categories={categories}
            activeCategoryId={activeCategoryId}
            onCategorySelect={setActiveCategoryId}
          />

          <section className="menu-content" aria-live="polite">
            {isLoading ? (
              <p className="menu-status">{uiCopy.loadingText}</p>
            ) : (
              <>
                {errorMessage ? (
                  <div className="menu-status menu-status--error">
                    <span>{errorMessage}</span>
                    <button
                      type="button"
                      className="menu-retry-button"
                      onClick={() => setRetryToken((current) => current + 1)}
                    >
                      {uiCopy.retryText}
                    </button>
                  </div>
                ) : null}

                {usingFallback ? <p className="menu-hint">{uiCopy.fallbackText}</p> : null}

                <h2 className="menu-content__title">{activeCategory?.name ?? uiCopy.categoryTitle}</h2>

                {activeCategory?.items.length ? (
                  <div className="menu-content__grid">
                    {activeCategory.items.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        name={item.name}
                        description={item.description}
                        price={item.priceMinor / 100}
                        currency={item.currency}
                        locale={selectedLanguage}
                        allergens={item.allergens}
                        imageUrl={item.imageUrl ?? undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="menu-content__empty">{uiCopy.noItemsText}</p>
                )}
              </>
            )}
          </section>
        </main>

        <MenuFooter
          address={menuPayload?.store.address ?? undefined}
          phone={menuPayload?.store.phone ?? undefined}
          email={menuPayload?.store.email ?? undefined}
          socialLinks={socialLinks}
        />
      </div>
    </div>
  );
};

export default MenuPage;
