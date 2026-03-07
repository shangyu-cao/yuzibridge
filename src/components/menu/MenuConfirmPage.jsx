import React, { useMemo } from "react";
import "./menu-confirm.css";

const readCheckoutPreview = () => {
  try {
    const raw = sessionStorage.getItem("menu_checkout_preview");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const formatMoneyMinor = (value, currency, locale) => {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale || "zh-CN", {
    style: "currency",
    currency: currency || "CNY",
    minimumFractionDigits: 2,
  }).format(amount / 100);
};

const MenuConfirmPage = () => {
  const preview = useMemo(() => readCheckoutPreview(), []);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const storeSlug = preview?.storeSlug || searchParams.get("store") || "";
  const language = preview?.language || searchParams.get("lang") || "zh-CN";
  const currency = preview?.currency || "CNY";
  const items = Array.isArray(preview?.items) ? preview.items : [];
  const totalMinor = Number.isFinite(preview?.totalMinor)
    ? preview.totalMinor
    : items.reduce((sum, item) => sum + (item?.lineTotalMinor || 0), 0);
  const totalCount = items.reduce((sum, item) => sum + (item?.quantity || 0), 0);
  const backMenuUrl = storeSlug ? `/menu/${encodeURIComponent(storeSlug)}` : "/menu";

  return (
    <main className="menu-confirm-page">
      <section className="menu-confirm-card">
        <h1 className="menu-confirm-title">购物车确认</h1>

        {preview ? (
          <>
            <p className="menu-confirm-store">
              {preview.storeName || storeSlug}
            </p>

            <ul className="menu-confirm-list">
              {items.map((item) => (
                <li key={item.id} className="menu-confirm-item">
                  <div>
                    <p className="menu-confirm-item-name">{item.name}</p>
                    <p className="menu-confirm-item-qty">x {item.quantity}</p>
                  </div>
                  <p className="menu-confirm-item-total">
                    {formatMoneyMinor(item.lineTotalMinor, item.currency || currency, language)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="menu-confirm-summary">
              <span>{totalCount} 份</span>
              <strong>{formatMoneyMinor(totalMinor, currency, language)}</strong>
            </div>
          </>
        ) : (
          <p className="menu-confirm-empty">未找到购物车数据，请返回菜单重新选择。</p>
        )}

        <button
          type="button"
          className="menu-confirm-back-button"
          onClick={() => window.location.assign(backMenuUrl)}
        >
          返回菜单
        </button>
      </section>
    </main>
  );
};

export default MenuConfirmPage;
