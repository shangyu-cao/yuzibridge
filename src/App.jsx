import React from "react";
import "./App.css";
import logo from "./assets/logo.png";
import MenuPage from "./components/menu/MenuPage";
import MenuConfirmPage from "./components/menu/MenuConfirmPage";
import MerchantItemsAdmin from "./components/admin/MerchantItemsAdmin";
import MerchantRegisterPage from "./components/admin/MerchantRegisterPage";

const DEFAULT_MENU_SLUG = "dunwuzhai";

const parseMenuSlugFromPath = (pathname) => {
  const normalizedPath = pathname.replace(/\/+$/, "");
  const prefixes = ["/menu-preview", "/menu"];

  for (const prefix of prefixes) {
    if (normalizedPath === prefix) {
      return DEFAULT_MENU_SLUG;
    }

    if (normalizedPath.startsWith(`${prefix}/`)) {
      const slug = normalizedPath.slice(prefix.length + 1).trim();
      if (!slug) {
        return DEFAULT_MENU_SLUG;
      }
      return decodeURIComponent(slug);
    }
  }

  return null;
};

const isMerchantAdminPath = (pathname) => {
  const normalizedPath = pathname.replace(/\/+$/, "");
  return normalizedPath === "/merchant-admin" || normalizedPath.startsWith("/merchant-admin/");
};

const isMerchantRegisterPath = (pathname) => {
  const normalizedPath = pathname.replace(/\/+$/, "");
  return normalizedPath === "/merchant-register" || normalizedPath.startsWith("/merchant-register/");
};

const isMenuConfirmPath = (pathname) => {
  const normalizedPath = pathname.replace(/\/+$/, "");
  return normalizedPath === "/menu-confirm" || normalizedPath.startsWith("/menu-confirm/");
};

const FEATURE_ITEMS = [
  {
    title: "多语言菜单引擎",
    description: "支持 8+ 语种实时切换，顾客扫码即点即看，降低跨语言沟通成本。",
  },
  {
    title: "商家后台一体化",
    description: "分类、菜品、订单、店铺资料统一管理，拖拽排序与状态流转更高效。",
  },
  {
    title: "SaaS 多门店架构",
    description: "面向连锁品牌和代理商，按门店隔离数据，统一运维与扩展部署。",
  },
];

const WORKFLOW_ITEMS = [
  { title: "创建店铺", description: "配置店铺名、Logo、地址与联系方式。", step: "01" },
  { title: "维护菜单", description: "按分类录入菜品、价格、过敏原与图片。", step: "02" },
  { title: "顾客扫码点单", description: "自动按浏览器语言展示菜单并提交订单。", step: "03" },
  { title: "后厨处理订单", description: "接受、准备、完成订单，全流程可视。", step: "04" },
];

const SCENE_ITEMS = [
  { title: "中餐 / 日料 / 西餐", text: "支持图文菜单、过敏原标注、桌号点单。" },
  { title: "咖啡 / 甜品 / 酒吧", text: "快速上新与季节菜单切换，适配移动端浏览。" },
  { title: "连锁品牌出海", text: "一套后台管理多地区门店，统一体验与数据。" },
];

function App() {
  if (isMerchantRegisterPath(window.location.pathname)) {
    return <MerchantRegisterPage />;
  }

  if (isMerchantAdminPath(window.location.pathname)) {
    return <MerchantItemsAdmin />;
  }

  if (isMenuConfirmPath(window.location.pathname)) {
    return <MenuConfirmPage />;
  }

  const menuSlug = parseMenuSlugFromPath(window.location.pathname);
  if (menuSlug) {
    return <MenuPage storeSlug={menuSlug} />;
  }

  return (
    <div className="home">
      <div className="home-bg home-bg--left" />
      <div className="home-bg home-bg--right" />

      <header className="header">
        <div className="logo-container">
          <img src={logo} alt="logo" className="logo-img" />
          <span className="logo-text">YUZIBRIDGE</span>
        </div>

        <nav className="nav">
          <a href="#home" className="nav-item active">
            首页
          </a>
          <a href="#features" className="nav-item">
            产品
          </a>
          <a href="#workflow" className="nav-item">
            服务
          </a>
          <a href="#scenes" className="nav-item">
            关于我们
          </a>
          <a href="#contact" className="nav-item">
            联系我们
          </a>
          <a href="/merchant-register" className="nav-auth-button nav-auth-button--secondary">
            注册
          </a>
          <a href="/merchant-admin" className="nav-auth-button">
            登录
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <p className="hero-badge">餐饮数字化 · 多语言菜单 SaaS</p>
            <h1 className="hero-title">让全球顾客都能看懂、点对、点快</h1>
            <p className="hero-subtitle">
              从扫码菜单到订单流转，YUZIBRIDGE 帮助餐厅搭建多语言点单体验与商家管理后台，
              在保证品牌统一性的同时，提升出品效率与顾客满意度。
            </p>
            <div className="hero-actions">
              <a className="hero-primary-btn" href="/merchant-admin">
                立即登录后台
              </a>
              <a className="hero-secondary-btn" href="/menu-preview/dunwuzhai">
                查看菜单示例
              </a>
            </div>
          </div>

          <div className="hero-stats">
            <article>
              <strong>8+</strong>
              <span>语言覆盖</span>
            </article>
            <article>
              <strong>99.9%</strong>
              <span>可用性目标</span>
            </article>
            <article>
              <strong>&lt;3 min</strong>
              <span>新店初始化</span>
            </article>
          </div>
        </section>

        <section className="section section-features" id="features">
          <div className="section-heading">
            <h2>核心能力</h2>
            <p>围绕“翻译、点单、履约”打造完整闭环。</p>
          </div>
          <div className="feature-grid">
            {FEATURE_ITEMS.map((item) => (
              <article className="feature-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-workflow" id="workflow">
          <div className="section-heading">
            <h2>上手流程</h2>
            <p>无需复杂培训，按步骤即可快速上线。</p>
          </div>
          <div className="workflow-grid">
            {WORKFLOW_ITEMS.map((item) => (
              <article className="workflow-item" key={item.step}>
                <span className="workflow-step">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-scenes" id="scenes">
          <div className="section-heading">
            <h2>适用场景</h2>
            <p>适配不同餐饮业态，支持从单店到连锁扩展。</p>
          </div>
          <div className="scene-grid">
            {SCENE_ITEMS.map((item) => (
              <article className="scene-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section cta-banner" id="contact">
          <h2>准备开始你的多语言菜单系统？</h2>
          <p>联系我们获取部署建议，或直接登录后台体验完整功能。</p>
          <div className="hero-actions">
            <a className="hero-primary-btn" href="/merchant-register">
              立即注册
            </a>
            <a className="hero-secondary-btn" href="mailto:contact@yuzibridge.com">
              联系我们
            </a>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div>
          <strong>YUZIBRIDGE</strong>
          <p>Enterprise SaaS for multilingual restaurant operations.</p>
        </div>
        <p>© {new Date().getFullYear()} YUZIBRIDGE. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;