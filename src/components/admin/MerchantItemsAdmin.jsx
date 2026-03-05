import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./merchant-admin.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const TOKEN_KEY = "merchant_admin_token";
const USER_KEY = "merchant_admin_user";
const MEMBERSHIPS_KEY = "merchant_admin_memberships";
const STORE_KEY = "merchant_admin_store_id";

const emptyForm = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  currencyCode: "CNY",
  imageUrl: "",
  sortOrder: "0",
  isActive: true,
  isAvailable: true,
  allergenCodesText: "",
};

const parseStoredJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const formatMoneyMinor = (value, currency = "CNY") => {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format((value ?? 0) / 100);
};

const normalizeItemForm = (item) => {
  return {
    categoryId: item.categoryId ?? "",
    name: item.name ?? "",
    description: item.description ?? "",
    price: ((item.priceMinor ?? 0) / 100).toFixed(2),
    currencyCode: item.currencyCode ?? "CNY",
    imageUrl: item.imageUrl ?? "",
    sortOrder: String(item.sortOrder ?? 0),
    isActive: Boolean(item.isActive),
    isAvailable: Boolean(item.isAvailable),
    allergenCodesText: Array.isArray(item.allergenCodes) ? item.allergenCodes.join(", ") : "",
  };
};

const toItemPayload = (form) => {
  const priceFloat = Number.parseFloat(form.price);
  const priceMinor = Number.isFinite(priceFloat) ? Math.round(priceFloat * 100) : 0;
  const allergenCodes = form.allergenCodesText
    .split(/[，,]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  return {
    categoryId: form.categoryId,
    name: form.name.trim(),
    description: form.description.trim() || null,
    priceMinor: Math.max(0, priceMinor),
    currencyCode: (form.currencyCode || "CNY").trim().toUpperCase(),
    imageUrl: form.imageUrl.trim() || null,
    sortOrder: Math.max(0, Number.parseInt(form.sortOrder || "0", 10) || 0),
    isActive: Boolean(form.isActive),
    isAvailable: Boolean(form.isAvailable),
    allergenCodes,
  };
};

const MerchantItemsAdmin = () => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => parseStoredJson(localStorage.getItem(USER_KEY), null));
  const [memberships, setMemberships] = useState(() =>
    parseStoredJson(localStorage.getItem(MEMBERSHIPS_KEY), []),
  );
  const [selectedStoreId, setSelectedStoreId] = useState(() => localStorage.getItem(STORE_KEY) || "");

  const [email, setEmail] = useState("admin+dunwuzhai@yuzibridge.com");
  const [password, setPassword] = useState("ChangeMe123!");

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(emptyForm);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const fetchWithAuth = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = `请求失败 (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.message) {
          message = payload.message;
        }
      } catch {
        // ignore parse failure
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }, [token]);

  const resetForm = () => {
    setEditingItemId(null);
    setItemForm((current) => ({
      ...emptyForm,
      categoryId: current.categoryId || categories[0]?.id || "",
    }));
  };

  const loadData = useCallback(async () => {
    if (!token || !selectedStoreId) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const [categoryResp, itemResp] = await Promise.all([
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items`),
      ]);

      setCategories(categoryResp?.categories ?? []);
      setItems(itemResp?.items ?? []);
      setItemForm((current) => ({
        ...current,
        categoryId: current.categoryId || categoryResp?.categories?.[0]?.id || "",
      }));
    } catch (error) {
      setErrorMessage(error.message || "加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, selectedStoreId, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadData();
  }, [loadData, token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "登录失败");
      }

      const payload = await response.json();
      setToken(payload.token);
      setUser(payload.user);
      setMemberships(payload.memberships ?? []);

      const nextStoreId = payload.memberships?.[0]?.store_id ?? "";
      setSelectedStoreId(nextStoreId);

      localStorage.setItem(TOKEN_KEY, payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
      localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(payload.memberships ?? []));
      localStorage.setItem(STORE_KEY, nextStoreId);

      setSuccessMessage("登录成功");
    } catch (error) {
      setErrorMessage(error.message || "登录失败");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken("");
    setUser(null);
    setMemberships([]);
    setSelectedStoreId("");
    setCategories([]);
    setItems([]);
    setEditingItemId(null);
    setItemForm(emptyForm);
    setSuccessMessage("已退出登录");
    setErrorMessage("");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(MEMBERSHIPS_KEY);
    localStorage.removeItem(STORE_KEY);
  };

  const handleStoreChange = (storeId) => {
    setSelectedStoreId(storeId);
    localStorage.setItem(STORE_KEY, storeId);
    setEditingItemId(null);
  };

  const handleEdit = (item) => {
    setEditingItemId(item.id);
    setItemForm(normalizeItemForm(item));
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleDelete = async (item) => {
    const shouldDelete = window.confirm(`确定删除菜品「${item.name}」吗？`);
    if (!shouldDelete) return;

    setErrorMessage("");
    setSuccessMessage("");
    try {
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items/${item.id}`, {
        method: "DELETE",
      });
      setSuccessMessage("删除成功");
      await loadData();
      if (editingItemId === item.id) {
        resetForm();
      }
    } catch (error) {
      setErrorMessage(error.message || "删除失败");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedStoreId) {
      setErrorMessage("请先选择店铺");
      return;
    }
    if (!itemForm.categoryId) {
      setErrorMessage("请先选择分类");
      return;
    }

    setSubmitLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = toItemPayload(itemForm);
      if (!payload.name) {
        throw new Error("菜品名称不能为空");
      }

      if (editingItemId) {
        await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items/${editingItemId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("菜品更新成功");
      } else {
        await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("菜品创建成功");
      }

      await loadData();
      resetForm();
    } catch (error) {
      setErrorMessage(error.message || "保存失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="merchant-admin-page">
        <div className="merchant-admin-login-card">
          <h1>商家后台登录</h1>
          <p>登录后可管理菜品（增删改查）</p>

          <form onSubmit={handleLogin} className="merchant-admin-form">
            <label>
              邮箱
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button type="submit" disabled={loginLoading}>
              {loginLoading ? "登录中..." : "登录"}
            </button>
          </form>

          {errorMessage ? <p className="merchant-admin-error">{errorMessage}</p> : null}
          {successMessage ? <p className="merchant-admin-success">{successMessage}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="merchant-admin-page">
      <div className="merchant-admin-shell">
        <header className="merchant-admin-header">
          <div>
            <h1>商家后台 · 菜品管理</h1>
            <p>{user?.email ?? ""}</p>
          </div>

          <div className="merchant-admin-header-actions">
            <label className="merchant-admin-inline-label">
              店铺
              <select
                value={selectedStoreId}
                onChange={(event) => handleStoreChange(event.target.value)}
              >
                {memberships.map((membership) => (
                  <option key={membership.store_id} value={membership.store_id}>
                    {membership.store_id.slice(0, 8)}... ({membership.role})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        {errorMessage ? <p className="merchant-admin-error">{errorMessage}</p> : null}
        {successMessage ? <p className="merchant-admin-success">{successMessage}</p> : null}

        <div className="merchant-admin-grid">
          <section className="merchant-admin-card">
            <h2>{editingItemId ? "编辑菜品" : "新增菜品"}</h2>
            <form onSubmit={handleSubmit} className="merchant-admin-form">
              <label>
                分类
                <select
                  value={itemForm.categoryId}
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  required
                >
                  <option value="">请选择分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                菜品名称
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                描述
                <textarea
                  value={itemForm.description}
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                />
              </label>

              <div className="merchant-admin-row">
                <label>
                  价格
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.price}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, price: event.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  货币
                  <input
                    type="text"
                    maxLength={3}
                    value={itemForm.currencyCode}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, currencyCode: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>

              <div className="merchant-admin-row">
                <label>
                  排序
                  <input
                    type="number"
                    min="0"
                    value={itemForm.sortOrder}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                  />
                </label>

                <label>
                  图片 URL
                  <input
                    type="url"
                    placeholder="https://..."
                    value={itemForm.imageUrl}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, imageUrl: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label>
                过敏源代码（逗号分隔，如 gluten,soy）
                <input
                  type="text"
                  value={itemForm.allergenCodesText}
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, allergenCodesText: event.target.value }))
                  }
                />
              </label>

              <div className="merchant-admin-checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isActive}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                  />
                  启用
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.isAvailable}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, isAvailable: event.target.checked }))
                    }
                  />
                  可售
                </label>
              </div>

              <div className="merchant-admin-form-actions">
                <button type="submit" disabled={submitLoading}>
                  {submitLoading ? "保存中..." : editingItemId ? "保存修改" : "创建菜品"}
                </button>
                <button type="button" className="secondary" onClick={resetForm}>
                  重置
                </button>
              </div>
            </form>
          </section>

          <section className="merchant-admin-card">
            <div className="merchant-admin-table-header">
              <h2>菜品列表</h2>
              <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                {loading ? "刷新中..." : "刷新"}
              </button>
            </div>

            {!categories.length ? (
              <p className="merchant-admin-empty">
                当前店铺没有分类，无法新增菜品。请先通过 API 或后台创建分类。
              </p>
            ) : null}

            {!items.length ? (
              <p className="merchant-admin-empty">暂无菜品</p>
            ) : (
              <div className="merchant-admin-table-wrap">
                <table className="merchant-admin-table">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>分类</th>
                      <th>价格</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="merchant-admin-item-name">{item.name}</div>
                          <div className="merchant-admin-item-desc">{item.description}</div>
                        </td>
                        <td>{categoryNameMap.get(item.categoryId) ?? item.categoryId.slice(0, 8)}</td>
                        <td>{formatMoneyMinor(item.priceMinor, item.currencyCode)}</td>
                        <td>
                          <span>{item.isActive ? "启用" : "停用"}</span>
                          <span className="dot">·</span>
                          <span>{item.isAvailable ? "可售" : "下架"}</span>
                        </td>
                        <td>
                          <div className="merchant-admin-table-actions">
                            <button type="button" className="secondary" onClick={() => handleEdit(item)}>
                              编辑
                            </button>
                            <button type="button" className="danger" onClick={() => handleDelete(item)}>
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default MerchantItemsAdmin;
