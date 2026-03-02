import React, { useEffect, useMemo, useState } from "react";
import logo from "../../assets/logo.png";
import CategorySidebar from "./category/CategorySidebar";
import MenuItemCard from "./item/MenuItemCard";
import MenuFooter, { type SocialLink } from "./layout/MenuFooter";
import MenuHeader, { type LanguageOption } from "./layout/MenuHeader";
import "./menu.css";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  allergens: string[];
};

type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

type MenuContent = {
  storeName: string;
  categoryTitle: string;
  noItemsText: string;
  categories: MenuCategory[];
  address: string;
  phone: string;
  email: string;
  socialLinks: SocialLink[];
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "zh-CN", label: "Chinese", nativeLabel: "简体中文" },
  { code: "en-US", label: "English" },
  { code: "ja-JP", label: "Japanese", nativeLabel: "日本語" },
];

const MENU_DATA: Record<string, MenuContent> = {
  "zh-CN": {
    storeName: "柚子小馆",
    categoryTitle: "分类",
    noItemsText: "该分类暂无菜品。",
    categories: [
      {
        id: "chef-special",
        name: "主厨推荐",
        items: [
          {
            id: "signature-beef-noodle",
            name: "招牌牛肉面",
            description: "慢炖牛腩与手工面，汤底浓郁。",
            price: 58,
            allergens: ["麸质", "大豆"],
          },
          {
            id: "truffle-fried-rice",
            name: "黑松露炒饭",
            description: "鸡蛋炒饭搭配黑松露酱和时蔬。",
            price: 48,
            allergens: ["蛋", "大豆"],
          },
        ],
      },
      {
        id: "small-plates",
        name: "小食",
        items: [
          {
            id: "shrimp-spring-roll",
            name: "鲜虾春卷",
            description: "酥脆外皮包裹虾仁与蔬菜。",
            price: 32,
            allergens: ["甲壳类", "麸质"],
          },
          {
            id: "tofu-salad",
            name: "凉拌豆腐",
            description: "嫩豆腐配芝麻酱与海苔碎。",
            price: 26,
            allergens: ["大豆", "芝麻"],
          },
        ],
      },
      {
        id: "drinks",
        name: "饮品",
        items: [
          {
            id: "yuzu-sparkling",
            name: "柚子气泡饮",
            description: "新鲜柚子汁与苏打水。",
            price: 22,
            allergens: [],
          },
        ],
      },
    ],
    address: "上海市静安区示例路 88 号",
    phone: "+86 21 5555 8888",
    email: "hello@yuzibistro.com",
    socialLinks: [
      { label: "Instagram", url: "https://instagram.com" },
      { label: "Xiaohongshu", url: "https://xiaohongshu.com" },
    ],
  },
  "en-US": {
    storeName: "Yuzi Bistro",
    categoryTitle: "Categories",
    noItemsText: "No dishes in this category yet.",
    categories: [
      {
        id: "chef-special",
        name: "Chef's Specials",
        items: [
          {
            id: "signature-beef-noodle",
            name: "Signature Beef Noodles",
            description: "Slow-braised beef brisket with handmade noodles.",
            price: 58,
            allergens: ["Gluten", "Soy"],
          },
          {
            id: "truffle-fried-rice",
            name: "Truffle Fried Rice",
            description: "Egg fried rice with truffle paste and vegetables.",
            price: 48,
            allergens: ["Egg", "Soy"],
          },
        ],
      },
      {
        id: "small-plates",
        name: "Small Plates",
        items: [
          {
            id: "shrimp-spring-roll",
            name: "Shrimp Spring Rolls",
            description: "Crispy spring rolls with shrimp and vegetables.",
            price: 32,
            allergens: ["Shellfish", "Gluten"],
          },
          {
            id: "tofu-salad",
            name: "Cold Tofu Salad",
            description: "Silken tofu with sesame dressing and nori flakes.",
            price: 26,
            allergens: ["Soy", "Sesame"],
          },
        ],
      },
      {
        id: "drinks",
        name: "Drinks",
        items: [
          {
            id: "yuzu-sparkling",
            name: "Yuzu Sparkling",
            description: "Fresh yuzu juice with sparkling water.",
            price: 22,
            allergens: [],
          },
        ],
      },
    ],
    address: "88 Sample Road, Jing'an District, Shanghai",
    phone: "+86 21 5555 8888",
    email: "hello@yuzibistro.com",
    socialLinks: [
      { label: "Instagram", url: "https://instagram.com" },
      { label: "Facebook", url: "https://facebook.com" },
    ],
  },
  "ja-JP": {
    storeName: "ユズビストロ",
    categoryTitle: "カテゴリ",
    noItemsText: "このカテゴリには料理がありません。",
    categories: [
      {
        id: "chef-special",
        name: "シェフおすすめ",
        items: [
          {
            id: "signature-beef-noodle",
            name: "特製牛肉麺",
            description: "じっくり煮込んだ牛バラ肉と手打ち麺。",
            price: 58,
            allergens: ["小麦", "大豆"],
          },
          {
            id: "truffle-fried-rice",
            name: "トリュフチャーハン",
            description: "卵チャーハンにトリュフソースと野菜を合わせました。",
            price: 48,
            allergens: ["卵", "大豆"],
          },
        ],
      },
      {
        id: "small-plates",
        name: "前菜",
        items: [
          {
            id: "shrimp-spring-roll",
            name: "海老春巻き",
            description: "海老と野菜を包んだサクサク春巻き。",
            price: 32,
            allergens: ["甲殻類", "小麦"],
          },
          {
            id: "tofu-salad",
            name: "冷奴サラダ",
            description: "絹ごし豆腐にごまドレッシングと海苔。",
            price: 26,
            allergens: ["大豆", "ごま"],
          },
        ],
      },
      {
        id: "drinks",
        name: "ドリンク",
        items: [
          {
            id: "yuzu-sparkling",
            name: "柚子スパークリング",
            description: "生搾り柚子ジュースと炭酸水。",
            price: 22,
            allergens: [],
          },
        ],
      },
    ],
    address: "上海市静安区サンプルロード88",
    phone: "+86 21 5555 8888",
    email: "hello@yuzibistro.com",
    socialLinks: [
      { label: "Instagram", url: "https://instagram.com" },
      { label: "LINE", url: "https://line.me" },
    ],
  },
};

const CURRENCY_BY_LANGUAGE: Record<string, string> = {
  "zh-CN": "CNY",
  "en-US": "USD",
  "ja-JP": "JPY",
};

const MenuPage: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("zh-CN");
  const menuContent = MENU_DATA[selectedLanguage] ?? MENU_DATA["en-US"];

  const categories = useMemo(
    () =>
      menuContent.categories.map((category) => ({
        id: category.id,
        name: category.name,
        itemCount: category.items.length,
      })),
    [menuContent],
  );

  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? "");

  useEffect(() => {
    const categoryExists = categories.some((category) => category.id === activeCategoryId);
    if (!categoryExists) {
      setActiveCategoryId(categories[0]?.id ?? "");
    }
  }, [activeCategoryId, categories]);

  const activeCategory = useMemo(
    () =>
      menuContent.categories.find((category) => category.id === activeCategoryId) ??
      menuContent.categories[0],
    [activeCategoryId, menuContent],
  );

  return (
    <div className="menu-page">
      <div className="menu-shell">
        <MenuHeader
          storeName={menuContent.storeName}
          logoUrl={logo}
          selectedLanguage={selectedLanguage}
          languages={LANGUAGE_OPTIONS}
          onLanguageChange={setSelectedLanguage}
        />

        <main className="menu-main">
          <CategorySidebar
            title={menuContent.categoryTitle}
            categories={categories}
            activeCategoryId={activeCategoryId}
            onCategorySelect={setActiveCategoryId}
          />

          <section className="menu-content" aria-live="polite">
            <h2 className="menu-content__title">{activeCategory?.name}</h2>

            {activeCategory?.items.length ? (
              <div className="menu-content__grid">
                {activeCategory.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                    currency={CURRENCY_BY_LANGUAGE[selectedLanguage] ?? "USD"}
                    locale={selectedLanguage}
                    allergens={item.allergens}
                  />
                ))}
              </div>
            ) : (
              <p className="menu-content__empty">{menuContent.noItemsText}</p>
            )}
          </section>
        </main>

        <MenuFooter
          address={menuContent.address}
          phone={menuContent.phone}
          email={menuContent.email}
          socialLinks={menuContent.socialLinks}
        />
      </div>
    </div>
  );
};

export default MenuPage;
