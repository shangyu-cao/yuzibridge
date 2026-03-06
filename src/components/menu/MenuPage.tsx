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

type PublicMenuItem = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  priceMinor: number;
  currency: string;
  sortOrder: number;
  allergens: string[];
};

type PublicMenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: PublicMenuItem[];
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
  categories: PublicMenuCategory[];
};

type PublicCreateOrderResponse = {
  orderId: string;
  storeId: string;
  storeSlug: string;
  tableCode?: string | null;
  status: string;
  createdAt: string;
  totalMinor: number;
  currencyCode: string;
  items: Array<{
    menuItemId: string;
    itemNameSnapshot: string;
    priceMinor: number;
    currencyCode: string;
    quantity: number;
  }>;
};

type MenuPageProps = {
  storeSlug: string;
};

type UiCopy = {
  languageLabel: string;
  categoryTitle: string;
  noItemsText: string;
  loadingText: string;
  errorText: string;
  fallbackText: string;
  retryText: string;
  addToOrderText: string;
  orderLabel: string;
  orderItemsLabel: string;
  orderEmptyText: string;
  orderConfirmText: string;
  tableCodeLabel: string;
  orderSubmittingText: string;
  orderSubmittedText: string;
  orderSubmitErrorText: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const LANGUAGE_PRESET_LABELS: Record<string, { label: string; nativeLabel: string }> = {
  "en-US": { label: "English", nativeLabel: "English" },
  "zh-CN": { label: "中文", nativeLabel: "中文" },
  "ja-JP": { label: "日本語", nativeLabel: "日本語" },
  "ko-KR": { label: "한국어", nativeLabel: "한국어" },
  "es-ES": { label: "Español", nativeLabel: "Español" },
  "fr-FR": { label: "Français", nativeLabel: "Français" },
  "de-DE": { label: "Deutsch", nativeLabel: "Deutsch" },
  "ar-SA": { label: "العربية", nativeLabel: "العربية" },
};

const FALLBACK_LANGUAGES: LanguageOption[] = [
  { code: "en-US", label: "English", nativeLabel: "English" },
  { code: "zh-CN", label: "中文", nativeLabel: "中文" },
  { code: "ja-JP", label: "日本語", nativeLabel: "日本語" },
  { code: "ko-KR", label: "한국어", nativeLabel: "한국어" },
  { code: "es-ES", label: "Español", nativeLabel: "Español" },
  { code: "fr-FR", label: "Français", nativeLabel: "Français" },
  { code: "de-DE", label: "Deutsch", nativeLabel: "Deutsch" },
  { code: "ar-SA", label: "العربية", nativeLabel: "العربية" },
];

const normalizeLanguageCode = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parts = trimmed.split("-");
  if (parts.length === 1) return parts[0].toLowerCase();
  return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
};

const getBrowserPreferredLanguageCodes = (): string[] => {
  if (typeof window === "undefined") return [];
  const candidates = Array.isArray(window.navigator.languages) && window.navigator.languages.length
    ? window.navigator.languages
    : [window.navigator.language];
  return candidates.map(normalizeLanguageCode).filter(Boolean);
};

const findBestMatchingLanguageCode = (targetCode: string, options: LanguageOption[]): string | null => {
  const normalizedTarget = normalizeLanguageCode(targetCode);
  if (!normalizedTarget) return null;
  const exact = options.find(
    (option) => normalizeLanguageCode(option.code) === normalizedTarget,
  );
  if (exact) return exact.code;

  const targetBase = normalizedTarget.split("-")[0];
  const baseMatch = options.find((option) => normalizeLanguageCode(option.code).split("-")[0] === targetBase);
  return baseMatch?.code ?? null;
};

const resolveInitialLanguage = (
  options: LanguageOption[],
  fallbackLanguageCode: string,
): { initialCode: string; needsBrowserOption: boolean } => {
  const browserPreferred = getBrowserPreferredLanguageCodes();
  for (const browserCode of browserPreferred) {
    const matched = findBestMatchingLanguageCode(browserCode, options);
    if (matched) {
      return { initialCode: matched, needsBrowserOption: false };
    }
  }

  const primaryBrowser = browserPreferred[0];
  if (primaryBrowser) {
    return { initialCode: primaryBrowser, needsBrowserOption: true };
  }

  return { initialCode: fallbackLanguageCode, needsBrowserOption: false };
};

const withBrowserLanguageOption = (
  options: LanguageOption[],
  browserCode: string,
  needsBrowserOption: boolean,
): LanguageOption[] => {
  if (!needsBrowserOption) return options;
  return [
    {
      code: browserCode,
      label: browserCode,
      nativeLabel: browserCode,
    },
    ...options,
  ];
};

const UI_COPY: Record<string, UiCopy> = {
  "zh-CN": {
    languageLabel: "语言",
    categoryTitle: "分类",
    noItemsText: "该分类暂无菜品。",
    loadingText: "正在加载菜单...",
    errorText: "菜单数据加载失败",
    fallbackText: "当前显示演示数据，请检查后端服务和数据库连接。",
    retryText: "重试",
    addToOrderText: "加入购物篮",
    orderLabel: "订单",
    orderItemsLabel: "份",
    orderEmptyText: "购物篮为空",
    orderConfirmText: "确定",
    tableCodeLabel: "桌号",
    orderSubmittingText: "提交中...",
    orderSubmittedText: "下单成功，订单号：",
    orderSubmitErrorText: "下单失败，请重试",
  },
  "en-US": {
    languageLabel: "Language",
    categoryTitle: "Categories",
    noItemsText: "No dishes in this category yet.",
    loadingText: "Loading menu...",
    errorText: "Failed to load menu data",
    fallbackText: "Showing demo data. Please check backend service and database connection.",
    retryText: "Retry",
    addToOrderText: "Add to basket",
    orderLabel: "Order",
    orderItemsLabel: "items",
    orderEmptyText: "Your basket is empty",
    orderConfirmText: "Confirm",
    tableCodeLabel: "Table",
    orderSubmittingText: "Submitting...",
    orderSubmittedText: "Order submitted. Order ID: ",
    orderSubmitErrorText: "Failed to submit order. Please retry.",
  },
  "ja-JP": {
    languageLabel: "言語",
    categoryTitle: "カテゴリ",
    noItemsText: "このカテゴリには料理がありません。",
    loadingText: "メニューを読み込み中...",
    errorText: "メニューデータの読み込みに失敗しました",
    fallbackText: "現在はデモデータを表示しています。バックエンドとDB接続を確認してください。",
    retryText: "再試行",
    addToOrderText: "カートに追加",
    orderLabel: "注文",
    orderItemsLabel: "点",
    orderEmptyText: "カートは空です",
    orderConfirmText: "確定",
    tableCodeLabel: "テーブル",
    orderSubmittingText: "送信中...",
    orderSubmittedText: "注文が完了しました。注文ID: ",
    orderSubmitErrorText: "注文に失敗しました。再試行してください。",
  },
  "ko-KR": {
    languageLabel: "언어",
    categoryTitle: "카테고리",
    noItemsText: "이 카테고리에 메뉴가 없습니다.",
    loadingText: "메뉴를 불러오는 중...",
    errorText: "메뉴 데이터를 불러오지 못했습니다",
    fallbackText: "데모 데이터를 표시 중입니다. 백엔드 서비스와 DB 연결을 확인하세요.",
    retryText: "다시 시도",
    addToOrderText: "장바구니에 추가",
    orderLabel: "주문",
    orderItemsLabel: "개",
    orderEmptyText: "장바구니가 비어 있습니다",
    orderConfirmText: "확인",
    tableCodeLabel: "테이블",
    orderSubmittingText: "제출 중...",
    orderSubmittedText: "주문이 접수되었습니다. 주문 ID: ",
    orderSubmitErrorText: "주문 제출에 실패했습니다. 다시 시도해 주세요.",
  },
  "es-ES": {
    languageLabel: "Idioma",
    categoryTitle: "Categorías",
    noItemsText: "No hay platos en esta categoría.",
    loadingText: "Cargando menú...",
    errorText: "Error al cargar los datos del menú",
    fallbackText: "Mostrando datos de demostración. Verifique el backend y la conexión de la base de datos.",
    retryText: "Reintentar",
    addToOrderText: "Agregar a la cesta",
    orderLabel: "Pedido",
    orderItemsLabel: "artículos",
    orderEmptyText: "Tu cesta está vacía",
    orderConfirmText: "Confirmar",
    tableCodeLabel: "Mesa",
    orderSubmittingText: "Enviando...",
    orderSubmittedText: "Pedido enviado. ID del pedido: ",
    orderSubmitErrorText: "No se pudo enviar el pedido. Inténtalo de nuevo.",
  },
  "fr-FR": {
    languageLabel: "Langue",
    categoryTitle: "Catégories",
    noItemsText: "Aucun plat dans cette catégorie.",
    loadingText: "Chargement du menu...",
    errorText: "Échec du chargement du menu",
    fallbackText:
      "Affichage des données de démonstration. Vérifiez le service backend et la connexion à la base de données.",
    retryText: "Réessayer",
    addToOrderText: "Ajouter au panier",
    orderLabel: "Commande",
    orderItemsLabel: "articles",
    orderEmptyText: "Votre panier est vide",
    orderConfirmText: "Confirmer",
    tableCodeLabel: "Table",
    orderSubmittingText: "Envoi...",
    orderSubmittedText: "Commande envoyée. ID : ",
    orderSubmitErrorText: "Échec de l'envoi. Veuillez réessayer.",
  },
  "de-DE": {
    languageLabel: "Sprache",
    categoryTitle: "Kategorien",
    noItemsText: "Keine Gerichte in dieser Kategorie.",
    loadingText: "Menü wird geladen...",
    errorText: "Menüdaten konnten nicht geladen werden",
    fallbackText: "Demo-Daten werden angezeigt. Bitte Backend und Datenbankverbindung prüfen.",
    retryText: "Erneut versuchen",
    addToOrderText: "In den Warenkorb",
    orderLabel: "Bestellung",
    orderItemsLabel: "Artikel",
    orderEmptyText: "Ihr Warenkorb ist leer",
    orderConfirmText: "Bestätigen",
    tableCodeLabel: "Tisch",
    orderSubmittingText: "Wird gesendet...",
    orderSubmittedText: "Bestellung gesendet. Bestell-ID: ",
    orderSubmitErrorText: "Bestellung fehlgeschlagen. Bitte erneut versuchen.",
  },
  "ar-SA": {
    languageLabel: "اللغة",
    categoryTitle: "الفئات",
    noItemsText: "لا توجد أطباق في هذه الفئة.",
    loadingText: "جارٍ تحميل القائمة...",
    errorText: "تعذر تحميل بيانات القائمة",
    fallbackText: "يتم عرض بيانات تجريبية. يرجى التحقق من الخادم وقاعدة البيانات.",
    retryText: "إعادة المحاولة",
    addToOrderText: "أضف إلى السلة",
    orderLabel: "الطلب",
    orderItemsLabel: "عناصر",
    orderEmptyText: "السلة فارغة",
    orderConfirmText: "تأكيد",
    tableCodeLabel: "الطاولة",
    orderSubmittingText: "جارٍ الإرسال...",
    orderSubmittedText: "تم إرسال الطلب. رقم الطلب: ",
    orderSubmitErrorText: "فشل إرسال الطلب. يرجى المحاولة مرة أخرى.",
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
  const normalized = normalizeLanguageCode(languageCode);
  if (UI_COPY[normalized]) {
    return UI_COPY[normalized];
  }
  const base = normalized.split("-")[0];
  if (base === "zh") return UI_COPY["zh-CN"];
  if (base === "ja") return UI_COPY["ja-JP"];
  if (base === "ko") return UI_COPY["ko-KR"];
  if (base === "es") return UI_COPY["es-ES"];
  if (base === "fr") return UI_COPY["fr-FR"];
  if (base === "de") return UI_COPY["de-DE"];
  if (base === "ar") return UI_COPY["ar-SA"];
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

const buildMenuPath = (storeSlug: string, languageCode: string, dynamicTranslate: boolean) => {
  const params = new URLSearchParams();
  params.set("lang", languageCode);
  if (dynamicTranslate) {
    params.set("dynamicTranslate", "true");
  }
  return `/api/public/stores/${encodeURIComponent(storeSlug)}/menu?${params.toString()}`;
};

const postJson = async <T,>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.json();
};

const toLanguageOptions = (payload: PublicLanguageResponse): LanguageOption[] => {
  if (!payload.languages.length) {
    return FALLBACK_LANGUAGES;
  }

  return payload.languages.map((language) => ({
    code: language.code,
    label: LANGUAGE_PRESET_LABELS[language.code]?.label ?? language.englishName,
    nativeLabel: LANGUAGE_PRESET_LABELS[language.code]?.nativeLabel ?? language.name,
  }));
};

const toSocialLinks = (links: Array<{ platform: string; url: string }>): SocialLink[] => {
  return links.map((link) => ({
    label: titleCase(link.platform),
    url: link.url,
  }));
};

const formatMoneyMinor = (priceMinor: number, currency: string, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(priceMinor / 100);
};

const MenuPage: React.FC<MenuPageProps> = ({ storeSlug }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    normalizeLanguageCode(getBrowserPreferredLanguageCodes()[0] || "zh-CN"),
  );
  const [languages, setLanguages] = useState<LanguageOption[]>(FALLBACK_LANGUAGES);
  const [menuPayload, setMenuPayload] = useState<PublicMenuResponse | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [basketQuantities, setBasketQuantities] = useState<Record<string, number>>({});
  const [isOrderExpanded, setIsOrderExpanded] = useState<boolean>(false);
  const [tableCode, setTableCode] = useState<string>("");
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);
  const [orderSubmitMessage, setOrderSubmitMessage] = useState<string>("");
  const [orderSubmitError, setOrderSubmitError] = useState<string>("");
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
        const fallbackCode = options.find((option) => option.code === payload.defaultLanguage)?.code
          ?? options[0]?.code
          ?? "zh-CN";
        const { initialCode, needsBrowserOption } = resolveInitialLanguage(options, fallbackCode);
        const nextOptions = withBrowserLanguageOption(options, initialCode, needsBrowserOption);
        setLanguages(nextOptions);
        setSelectedLanguage(initialCode);
      } catch (_error) {
        if (ignore) {
          return;
        }

        const fallbackCode = "zh-CN";
        const { initialCode, needsBrowserOption } = resolveInitialLanguage(FALLBACK_LANGUAGES, fallbackCode);
        const nextOptions = withBrowserLanguageOption(FALLBACK_LANGUAGES, initialCode, needsBrowserOption);
        setLanguages(nextOptions);
        setSelectedLanguage(initialCode);
      }
    };

    loadLanguages();

    return () => {
      ignore = true;
    };
  }, [storeSlug]);

  useEffect(() => {
    setBasketQuantities({});
    setIsOrderExpanded(false);
    setOrderSubmitMessage("");
    setOrderSubmitError("");
    const queryTable = new URLSearchParams(window.location.search).get("table");
    setTableCode(queryTable ?? "");
  }, [storeSlug]);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setErrorMessage("");
    setUsingFallback(false);

    const loadMenu = async () => {
      try {
        const payload = await fetchJson<PublicMenuResponse>(
          buildMenuPath(storeSlug, selectedLanguage, true),
        );

        if (ignore) {
          return;
        }

        setMenuPayload(payload);
      } catch (_dynamicTranslateError) {
        if (ignore) {
          return;
        }

        try {
          const payload = await fetchJson<PublicMenuResponse>(
            buildMenuPath(storeSlug, selectedLanguage, false),
          );
          if (ignore) {
            return;
          }
          setMenuPayload(payload);
        } catch (_menuError) {
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
        }
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

  const allMenuItems = useMemo(
    () => (menuPayload?.categories ?? []).flatMap((category) => category.items),
    [menuPayload],
  );

  const menuItemMap = useMemo(() => {
    return new Map(allMenuItems.map((item) => [item.id, item]));
  }, [allMenuItems]);

  useEffect(() => {
    setBasketQuantities((current) => {
      const nextEntries = Object.entries(current).filter(
        ([itemId, quantity]) => quantity > 0 && menuItemMap.has(itemId),
      );
      const hasChanges = nextEntries.length !== Object.keys(current).length;
      if (!hasChanges) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [menuItemMap]);

  const basketLineItems = useMemo(() => {
    return allMenuItems
      .map((item) => {
        const quantity = basketQuantities[item.id] ?? 0;
        if (quantity <= 0) {
          return null;
        }

        return {
          ...item,
          quantity,
          lineTotalMinor: item.priceMinor * quantity,
        };
      })
      .filter(Boolean) as Array<PublicMenuItem & { quantity: number; lineTotalMinor: number }>;
  }, [allMenuItems, basketQuantities]);

  const basketItemsCount = useMemo(
    () => basketLineItems.reduce((sum, item) => sum + item.quantity, 0),
    [basketLineItems],
  );
  const basketTotalMinor = useMemo(
    () => basketLineItems.reduce((sum, item) => sum + item.lineTotalMinor, 0),
    [basketLineItems],
  );
  const basketCurrency = basketLineItems[0]?.currency ?? "USD";

  useEffect(() => {
    if (basketItemsCount === 0) {
      setIsOrderExpanded(false);
    }
  }, [basketItemsCount]);

  const addItemToBasket = (itemId: string) => {
    setBasketQuantities((current) => ({
      ...current,
      [itemId]: (current[itemId] ?? 0) + 1,
    }));
  };

  const removeItemFromBasket = (itemId: string) => {
    setBasketQuantities((current) => {
      const quantity = current[itemId] ?? 0;
      if (quantity <= 1) {
        const next = { ...current };
        delete next[itemId];
        return next;
      }

      return {
        ...current,
        [itemId]: quantity - 1,
      };
    });
  };

  const handleConfirmOrder = async () => {
    if (!basketLineItems.length || orderSubmitting) {
      return;
    }

    setOrderSubmitting(true);
    setOrderSubmitError("");
    setOrderSubmitMessage("");

    try {
      const payload = {
        tableCode: tableCode.trim() || null,
        items: basketLineItems.map((line) => ({
          menuItemId: line.id,
          quantity: line.quantity,
        })),
      };

      const response = await postJson<PublicCreateOrderResponse>(
        `/api/public/stores/${encodeURIComponent(storeSlug)}/orders`,
        payload,
      );

      setOrderSubmitMessage(`${uiCopy.orderSubmittedText}${response.orderId}`);
      window.alert(`${uiCopy.orderSubmittedText}${response.orderId}`);
      setBasketQuantities({});
      setIsOrderExpanded(false);
    } catch (_error) {
      setOrderSubmitError(uiCopy.orderSubmitErrorText);
    } finally {
      setOrderSubmitting(false);
    }
  };

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
          languageLabel={uiCopy.languageLabel}
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
                        addButtonText={uiCopy.addToOrderText}
                        onAddToBasket={() => addItemToBasket(item.id)}
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

      {basketItemsCount > 0 ? (
        <section className={`order-drawer ${isOrderExpanded ? "order-drawer--expanded" : ""}`}>
          <button
            type="button"
            className="order-drawer__summary"
            onClick={() => setIsOrderExpanded((current) => !current)}
          >
            <div className="order-drawer__summary-left">
              <strong>{uiCopy.orderLabel}</strong>
              <span>
                {basketItemsCount} {uiCopy.orderItemsLabel}
              </span>
            </div>
            <div className="order-drawer__summary-right">
              {formatMoneyMinor(basketTotalMinor, basketCurrency, selectedLanguage)}
            </div>
          </button>

          {isOrderExpanded ? (
            <div className="order-drawer__panel">
              <div className="order-drawer__table-row">
                <label htmlFor="order-table-code">{uiCopy.tableCodeLabel}</label>
                <input
                  id="order-table-code"
                  type="text"
                  value={tableCode}
                  onChange={(event) => setTableCode(event.target.value)}
                  placeholder="A1"
                />
              </div>

              {orderSubmitError ? <p className="order-drawer__message error">{orderSubmitError}</p> : null}
              {orderSubmitMessage ? (
                <p className="order-drawer__message success">{orderSubmitMessage}</p>
              ) : null}

              <ul className="order-drawer__items">
                {basketLineItems.length ? (
                  basketLineItems.map((item) => (
                    <li key={item.id} className="order-drawer__item">
                      <div className="order-drawer__item-main">
                        <p className="order-drawer__item-name">{item.name}</p>
                        <p className="order-drawer__item-total">
                          {formatMoneyMinor(item.lineTotalMinor, item.currency, selectedLanguage)}
                        </p>
                      </div>

                      <div className="order-drawer__qty-controls">
                        <button
                          type="button"
                          className="order-drawer__qty-button"
                          onClick={() => removeItemFromBasket(item.id)}
                        >
                          -
                        </button>
                        <span className="order-drawer__qty-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="order-drawer__qty-button"
                          onClick={() => addItemToBasket(item.id)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="order-drawer__empty">{uiCopy.orderEmptyText}</li>
                )}
              </ul>

              <button
                type="button"
                className="order-drawer__confirm-button"
                disabled={orderSubmitting}
                onClick={handleConfirmOrder}
              >
                {orderSubmitting ? uiCopy.orderSubmittingText : uiCopy.orderConfirmText}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default MenuPage;
