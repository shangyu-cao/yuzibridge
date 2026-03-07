import React, { useMemo } from "react";

const readCheckoutPreview = () => {
  try {
    const raw = sessionStorage.getItem("menu_checkout_preview");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const MenuConfirmPage = () => {
  const preview = useMemo(() => readCheckoutPreview(), []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "20px 16px",
        background: "#f5f7fb",
        color: "#111827",
        fontSize: "14px",
      }}
    >
      <section
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          background: "#fff",
          borderRadius: "14px",
          border: "1px solid #e5e7eb",
          padding: "16px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px" }}>购物车确认页</h1>
        <p style={{ marginTop: "8px", color: "#4b5563" }}>
          已从菜单页跳转成功。确认页内容可在下一步继续完善。
        </p>

        {preview ? (
          <div style={{ marginTop: "14px" }}>
            <p style={{ margin: "0 0 6px" }}>
              店铺：<strong>{preview.storeName || preview.storeSlug}</strong>
            </p>
            <p style={{ margin: "0 0 10px" }}>
              菜品数量：<strong>{preview.items?.length ?? 0}</strong>
            </p>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
          <button
            type="button"
            style={{
              minHeight: "44px",
              padding: "0 14px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
            onClick={() => window.history.back()}
          >
            返回菜单
          </button>
        </div>
      </section>
    </main>
  );
};

export default MenuConfirmPage;
