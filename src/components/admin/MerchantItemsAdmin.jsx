import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./merchant-admin.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const TOKEN_KEY = "merchant_admin_token";
const USER_KEY = "merchant_admin_user";
const MEMBERSHIPS_KEY = "merchant_admin_memberships";
const STORE_KEY = "merchant_admin_store_id";

const DEFAULT_ALLERGEN_OPTIONS = [
  { code: "milk", label: "milk" },
  { code: "eggs", label: "eggs" },
  { code: "peanuts", label: "peanuts" },
  { code: "tree_nuts", label: "tree nuts" },
  { code: "gluten", label: "gluten" },
  { code: "soy", label: "soy" },
  { code: "fish", label: "fish" },
  { code: "shellfish", label: "shellfish" },
  { code: "sesame", label: "sesame" },
];

const ORDER_STATUS_LABEL = {
  new: "new",
  accepted: "accepted",
  preparing: "prepare",
  ready: "ready",
};

const EMPTY_ITEM_FORM = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  currencyCode: "CNY",
  imageUrl: "",
  sortOrder: "0",
  isActive: true,
  isAvailable: true,
  allergenCodes: [],
};

const EMPTY_CATEGORY_FORM = {
  name: "",
  description: "",
  isActive: true,
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

const formatDatetime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN");
};

const toItemPayload = (form) => {
  const priceFloat = Number.parseFloat(form.price);
  const priceMinor = Number.isFinite(priceFloat) ? Math.round(priceFloat * 100) : 0;
  const allergenCodes = Array.isArray(form.allergenCodes)
    ? form.allergenCodes.map((x) => x.trim().toLowerCase()).filter(Boolean)
    : [];

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

const toCategoryPayload = (form) => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  isActive: Boolean(form.isActive),
});

const normalizeItemForm = (item) => ({
  categoryId: item.categoryId ?? "",
  name: item.name ?? "",
  description: item.description ?? "",
  price: ((item.priceMinor ?? 0) / 100).toFixed(2),
  currencyCode: item.currencyCode ?? "CNY",
  imageUrl: item.imageUrl ?? "",
  sortOrder: String(item.sortOrder ?? 0),
  isActive: Boolean(item.isActive),
  isAvailable: Boolean(item.isAvailable),
  allergenCodes: Array.isArray(item.allergenCodes) ? item.allergenCodes : [],
});

const normalizeCategoryForm = (category) => ({
  name: category.name ?? "",
  description: category.description ?? "",
  isActive: Boolean(category.isActive),
});

const MerchantItemsAdmin = () => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => parseStoredJson(localStorage.getItem(USER_KEY), null));
  const [memberships, setMemberships] = useState(() =>
    parseStoredJson(localStorage.getItem(MEMBERSHIPS_KEY), []),
  );
  const [selectedStoreId, setSelectedStoreId] = useState(() => localStorage.getItem(STORE_KEY) || "");

  const [email, setEmail] = useState("admin+dunwuzhai@yuzibridge.com");
  const [password, setPassword] = useState("ChangeMe123!");

  const [activeTab, setActiveTab] = useState("items");

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [allergenOptions, setAllergenOptions] = useState(DEFAULT_ALLERGEN_OPTIONS);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");
  const [itemStatusFilter, setItemStatusFilter] = useState("all");
  const [priceSort, setPriceSort] = useState("none");
  const [draggingCategoryId, setDraggingCategoryId] = useState("");
  const [categorySortSaving, setCategorySortSaving] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [orderActionLoadingId, setOrderActionLoadingId] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const allergenLabelMap = useMemo(
    () => new Map(allergenOptions.map((option) => [option.code, option.label])),
    [allergenOptions],
  );

  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const rows = items.filter((item) => {
      const passCategory = activeCategoryFilter === "all" || item.categoryId === activeCategoryFilter;
      if (!passCategory) return false;

      const passStatus =
        itemStatusFilter === "all" ||
        (itemStatusFilter === "active" && item.isActive) ||
        (itemStatusFilter === "inactive" && !item.isActive) ||
        (itemStatusFilter === "available" && item.isAvailable) ||
        (itemStatusFilter === "unavailable" && !item.isAvailable);
      if (!passStatus) return false;

      if (!keyword) return true;
      const content = [item.name, item.description, ...(item.allergenCodes ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return content.includes(keyword);
    });

    if (priceSort === "asc") {
      rows.sort((a, b) => (a.priceMinor ?? 0) - (b.priceMinor ?? 0));
    } else if (priceSort === "desc") {
      rows.sort((a, b) => (b.priceMinor ?? 0) - (a.priceMinor ?? 0));
    }

    return rows;
  }, [activeCategoryFilter, itemStatusFilter, items, priceSort, searchKeyword]);

  const fetchWithAuth = useCallback(
    async (path, options = {}) => {
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
          if (payload?.message) message = payload.message;
        } catch {
          // ignore parse failure
        }
        throw new Error(message);
      }

      if (response.status === 204) return null;
      return response.json();
    },
    [token],
  );

  const loadData = useCallback(async () => {
    if (!token || !selectedStoreId) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const [categoryResp, itemResp, allergenResp, orderResp] = await Promise.all([
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/allergens`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/orders`),
      ]);

      setCategories(categoryResp?.categories ?? []);
      setItems(itemResp?.items ?? []);
      setOrders(orderResp?.orders ?? []);
      setAllergenOptions(DEFAULT_ALLERGEN_OPTIONS);

      setItemForm((current) => ({
        ...current,
        categoryId: current.categoryId || categoryResp?.categories?.[0]?.id || "",
      }));

      const backendCodes = new Set((allergenResp?.allergens ?? []).map((a) => a.code));
      const missingCodes = DEFAULT_ALLERGEN_OPTIONS.map((x) => x.code).filter(
        (code) => backendCodes.size > 0 && !backendCodes.has(code),
      );
      if (missingCodes.length > 0) {
        setErrorMessage(`数据库缺少过敏源代码: ${missingCodes.join(", ")}。请先运行 npm run db:seed`);
      }
    } catch (error) {
      setErrorMessage(error.message || "加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, selectedStoreId, token]);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [loadData, token]);

  useEffect(() => {
    if (activeCategoryFilter === "all") return;
    const exists = categories.some((category) => category.id === activeCategoryFilter);
    if (!exists) setActiveCategoryFilter("all");
  }, [activeCategoryFilter, categories]);

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemForm({
      ...EMPTY_ITEM_FORM,
      categoryId: categories[0]?.id ?? "",
    });
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
  };

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
      const nextStoreId = payload.memberships?.[0]?.store_id ?? "";

      setToken(payload.token);
      setUser(payload.user);
      setMemberships(payload.memberships ?? []);
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
    setOrders([]);
    resetItemForm();
    resetCategoryForm();
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
    resetItemForm();
    resetCategoryForm();
    setSearchKeyword("");
    setActiveCategoryFilter("all");
    setItemStatusFilter("all");
    setPriceSort("none");
  };

  const handleAllergenToggle = (allergenCode) => {
    setItemForm((current) => {
      const set = new Set(current.allergenCodes ?? []);
      if (set.has(allergenCode)) set.delete(allergenCode);
      else set.add(allergenCode);

      return { ...current, allergenCodes: [...set] };
    });
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!selectedStoreId) {
      setErrorMessage("请先选择店铺");
      return;
    }

    setUploadLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/admin/stores/${selectedStoreId}/uploads/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "上传图片失败");
      }

      const payload = await response.json();
      setItemForm((current) => ({ ...current, imageUrl: payload.imageUrl ?? "" }));
      setSuccessMessage("图片上传成功");
    } catch (error) {
      setErrorMessage(error.message || "上传图片失败");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm(normalizeItemForm(item));
    setActiveTab("items");
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`确定删除菜品「${item.name}」吗？`)) return;

    setErrorMessage("");
    setSuccessMessage("");
    try {
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items/${item.id}`, {
        method: "DELETE",
      });
      setSuccessMessage("菜品删除成功");
      await loadData();
      if (editingItemId === item.id) resetItemForm();
    } catch (error) {
      setErrorMessage(error.message || "删除失败");
    }
  };

  const handleSubmitItem = async (event) => {
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
      if (!payload.name) throw new Error("菜品名称不能为空");

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
      resetItemForm();
    } catch (error) {
      setErrorMessage(error.message || "保存失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm(normalizeCategoryForm(category));
    setActiveTab("categories");
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`确定删除分类「${category.name}」吗？`)) return;

    setErrorMessage("");
    setSuccessMessage("");
    try {
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories/${category.id}`, {
        method: "DELETE",
      });
      setSuccessMessage("分类删除成功");
      await loadData();
      if (editingCategoryId === category.id) resetCategoryForm();
    } catch (error) {
      setErrorMessage(error.message || "删除分类失败（请先删除分类下菜品）");
    }
  };

  const persistCategoryOrder = async (nextCategories) => {
    if (!selectedStoreId || !nextCategories.length) {
      return;
    }

    setCategorySortSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      for (let index = 0; index < nextCategories.length; index += 1) {
        const category = nextCategories[index];
        const nextSortOrder = (index + 1) * 10;
        await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories/${category.id}`, {
          method: "PUT",
          body: JSON.stringify({ sortOrder: nextSortOrder }),
        });
      }

      setSuccessMessage("分类顺序已保存");
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "保存分类顺序失败");
    } finally {
      setCategorySortSaving(false);
    }
  };

  const handleCategoryDragStart = (categoryId) => {
    setDraggingCategoryId(categoryId);
  };

  const handleCategoryDrop = async (targetCategoryId) => {
    if (!draggingCategoryId || draggingCategoryId === targetCategoryId) {
      setDraggingCategoryId("");
      return;
    }

    const sourceIndex = categories.findIndex((category) => category.id === draggingCategoryId);
    const targetIndex = categories.findIndex((category) => category.id === targetCategoryId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingCategoryId("");
      return;
    }

    const reordered = [...categories];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setCategories(reordered);
    setDraggingCategoryId("");
    await persistCategoryOrder(reordered);
  };

  const handleToggleCategoryActive = async (category) => {
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories/${category.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      setSuccessMessage("分类状态已更新");
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "更新分类状态失败");
    }
  };

  const handleSubmitCategory = async (event) => {
    event.preventDefault();
    if (!selectedStoreId) {
      setErrorMessage("请先选择店铺");
      return;
    }

    setSubmitLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = toCategoryPayload(categoryForm);
      if (!payload.name) throw new Error("分类名称不能为空");

      if (editingCategoryId) {
        await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories/${editingCategoryId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("分类更新成功");
      } else {
        const createPayload = {
          ...payload,
          sortOrder: (categories.length + 1) * 10,
        };
        await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories`, {
          method: "POST",
          body: JSON.stringify(createPayload),
        });
        setSuccessMessage("分类创建成功");
      }

      await loadData();
      resetCategoryForm();
    } catch (error) {
      setErrorMessage(error.message || "保存分类失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (order, status) => {
    setOrderActionLoadingId(order.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSuccessMessage(`订单 ${order.tableCode ?? "-"} 状态已更新`);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "更新订单状态失败");
    } finally {
      setOrderActionLoadingId("");
    }
  };

  const handleFinishOrder = async (order) => {
    const confirmed = window.confirm("确认完成并删除该订单吗？删除后将从列表消失。");
    if (!confirmed) return;

    setOrderActionLoadingId(order.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/orders/${order.id}`, {
        method: "DELETE",
      });
      setSuccessMessage(`订单 ${order.tableCode ?? "-"} 已完成并移除`);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "完成订单失败");
    } finally {
      setOrderActionLoadingId("");
    }
  };

  if (!token) {
    return (
      <div className="merchant-admin-page">
        <div className="merchant-admin-login-card">
          <h1>商家后台登录</h1>
          <p>登录后可管理分类、菜品与订单</p>

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
            <h1>商家后台管理</h1>
            <p>{user?.email ?? ""}</p>
          </div>

          <div className="merchant-admin-header-actions">
            <label className="merchant-admin-inline-label">
              店铺
              <select value={selectedStoreId} onChange={(event) => handleStoreChange(event.target.value)}>
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

        <div className="merchant-admin-tabs">
          <button
            type="button"
            className={activeTab === "categories" ? "secondary active-filter" : "secondary"}
            onClick={() => setActiveTab("categories")}
          >
            分类管理
          </button>
          <button
            type="button"
            className={activeTab === "items" ? "secondary active-filter" : "secondary"}
            onClick={() => setActiveTab("items")}
          >
            菜品管理
          </button>
          <button
            type="button"
            className={activeTab === "orders" ? "secondary active-filter" : "secondary"}
            onClick={() => setActiveTab("orders")}
          >
            订单管理
          </button>
        </div>

        {errorMessage ? <p className="merchant-admin-error">{errorMessage}</p> : null}
        {successMessage ? <p className="merchant-admin-success">{successMessage}</p> : null}

        {activeTab === "categories" ? (
          <div className="merchant-admin-grid">
            <section className="merchant-admin-card">
              <h2>{editingCategoryId ? "编辑分类" : "新增分类"}</h2>
              <form onSubmit={handleSubmitCategory} className="merchant-admin-form">
                <label>
                  分类名称
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  描述
                  <textarea
                    rows={3}
                    value={categoryForm.description}
                    onChange={(event) =>
                      setCategoryForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <label className="merchant-admin-switch-row">
                  启用
                  <span className="merchant-admin-switch">
                    <input
                      type="checkbox"
                      checked={categoryForm.isActive}
                      onChange={(event) =>
                        setCategoryForm((current) => ({ ...current, isActive: event.target.checked }))
                      }
                    />
                    <span />
                  </span>
                </label>
                <div className="merchant-admin-form-actions">
                  <button type="submit" disabled={submitLoading}>
                    {submitLoading ? "保存中..." : editingCategoryId ? "保存修改" : "创建分类"}
                  </button>
                  <button type="button" className="secondary" onClick={resetCategoryForm}>
                    重置
                  </button>
                </div>
              </form>
            </section>

            <section className="merchant-admin-card">
              <div className="merchant-admin-table-header">
                <h2>分类列表（拖拽排序）</h2>
                <div className="merchant-admin-table-header-actions">
                  <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                    {loading ? "刷新中..." : "刷新"}
                  </button>
                  <button type="button" className="secondary" onClick={() => persistCategoryOrder(categories)} disabled={categorySortSaving}>
                    {categorySortSaving ? "保存中..." : "保存当前顺序"}
                  </button>
                </div>
              </div>

              {!categories.length ? (
                <p className="merchant-admin-empty">暂无分类</p>
              ) : (
                <ul className="merchant-admin-category-list">
                  {categories.map((category, index) => (
                    <li
                      key={category.id}
                      className={`merchant-admin-category-item ${
                        draggingCategoryId === category.id ? "dragging" : ""
                      }`}
                      draggable
                      onDragStart={() => handleCategoryDragStart(category.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleCategoryDrop(category.id)}
                      onDragEnd={() => setDraggingCategoryId("")}
                    >
                      <div className="merchant-admin-category-grip" title="拖拽调整顺序">
                        ≡
                      </div>
                      <div className="merchant-admin-category-body">
                        <div className="merchant-admin-category-title-row">
                          <strong>{category.name}</strong>
                          <span className="merchant-admin-category-order">#{index + 1}</span>
                        </div>
                        <p>{category.description || "-"}</p>
                      </div>
                      <div className="merchant-admin-category-controls">
                        <label className="merchant-admin-switch compact">
                          <input
                            type="checkbox"
                            checked={Boolean(category.isActive)}
                            onChange={() => handleToggleCategoryActive(category)}
                          />
                          <span />
                        </label>
                        <button type="button" className="secondary" onClick={() => handleEditCategory(category)}>
                          编辑
                        </button>
                        <button type="button" className="danger" onClick={() => handleDeleteCategory(category)}>
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "items" ? (
          <div className="merchant-admin-grid">
            <section className="merchant-admin-card">
              <h2>{editingItemId ? "编辑菜品" : "新增菜品"}</h2>
              <form onSubmit={handleSubmitItem} className="merchant-admin-form">
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
                    rows={3}
                    value={itemForm.description}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, description: event.target.value }))
                    }
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
                    图片
                    <input
                      className="merchant-admin-file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploadLoading}
                      onChange={(event) => handleImageUpload(event.target.files?.[0])}
                    />
                    <small className="merchant-admin-help">
                      {uploadLoading ? "上传中..." : "支持 jpeg/png/webp/gif，最大 5MB"}
                    </small>
                  </label>
                </div>

                {itemForm.imageUrl ? (
                  <div className="merchant-admin-image-preview">
                    <img src={itemForm.imageUrl} alt="preview" />
                  </div>
                ) : null}

                <fieldset className="merchant-admin-allergen-fieldset">
                  <legend>过敏源</legend>
                  <div className="merchant-admin-allergen-grid">
                    {allergenOptions.map((allergen) => {
                      const checked = (itemForm.allergenCodes ?? []).includes(allergen.code);
                      return (
                        <label key={allergen.code} className="merchant-admin-allergen-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleAllergenToggle(allergen.code)}
                          />
                          <span>{allergen.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="merchant-admin-checkbox-row">
                  <label className="merchant-admin-switch-row">
                    启用
                    <span className="merchant-admin-switch">
                      <input
                        type="checkbox"
                        checked={itemForm.isActive}
                        onChange={(event) =>
                          setItemForm((current) => ({ ...current, isActive: event.target.checked }))
                        }
                      />
                      <span />
                    </span>
                  </label>
                  <label className="merchant-admin-switch-row">
                    可售
                    <span className="merchant-admin-switch">
                      <input
                        type="checkbox"
                        checked={itemForm.isAvailable}
                        onChange={(event) =>
                          setItemForm((current) => ({ ...current, isAvailable: event.target.checked }))
                        }
                      />
                      <span />
                    </span>
                  </label>
                </div>

                <div className="merchant-admin-form-actions">
                  <button type="submit" disabled={submitLoading}>
                    {submitLoading ? "保存中..." : editingItemId ? "保存修改" : "创建菜品"}
                  </button>
                  <button type="button" className="secondary" onClick={resetItemForm}>
                    重置
                  </button>
                </div>
              </form>
            </section>

            <section className="merchant-admin-card">
              <div className="merchant-admin-table-header">
                <h2>菜品列表</h2>
                <div className="merchant-admin-table-header-actions">
                  <input
                    className="merchant-admin-search-input"
                    type="search"
                    placeholder="搜索菜品名称/描述/过敏源"
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                  />
                  <select
                    className="merchant-admin-filter-select"
                    value={activeCategoryFilter}
                    onChange={(event) => setActiveCategoryFilter(event.target.value)}
                  >
                    <option value="all">全部分类</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="merchant-admin-filter-select"
                    value={itemStatusFilter}
                    onChange={(event) => setItemStatusFilter(event.target.value)}
                  >
                    <option value="all">全部状态</option>
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                    <option value="available">可售</option>
                    <option value="unavailable">下架</option>
                  </select>
                  <select
                    className="merchant-admin-filter-select"
                    value={priceSort}
                    onChange={(event) => setPriceSort(event.target.value)}
                  >
                    <option value="none">价格排序</option>
                    <option value="asc">价格从低到高</option>
                    <option value="desc">价格从高到低</option>
                  </select>
                  <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                    {loading ? "刷新中..." : "刷新"}
                  </button>
                </div>
              </div>

              {!filteredItems.length ? (
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
                      {filteredItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="merchant-admin-item-name">{item.name}</div>
                            <div className="merchant-admin-item-desc">{item.description}</div>
                            {item.allergenCodes?.length ? (
                              <div className="merchant-admin-item-tags">
                                {item.allergenCodes.map((code) => (
                                  <span key={code}>{allergenLabelMap.get(code) ?? code}</span>
                                ))}
                              </div>
                            ) : null}
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
                              <button type="button" className="secondary" onClick={() => handleEditItem(item)}>
                                编辑
                              </button>
                              <button type="button" className="danger" onClick={() => handleDeleteItem(item)}>
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
        ) : null}

        {activeTab === "orders" ? (
          <section className="merchant-admin-card">
            <div className="merchant-admin-table-header">
              <h2>订单列表</h2>
              <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                {loading ? "刷新中..." : "刷新"}
              </button>
            </div>

            {!orders.length ? (
              <p className="merchant-admin-empty">暂无订单</p>
            ) : (
              <div className="merchant-admin-orders">
                {orders.map((order) => (
                  <article key={order.id} className="merchant-admin-order-card">
                    <div className="merchant-admin-order-head">
                      <div>
                        <strong>桌号: {order.tableCode || "-"}</strong>
                        <p>
                          状态: {ORDER_STATUS_LABEL[order.status] ?? order.status} · 创建时间:{" "}
                          {formatDatetime(order.createdAt)}
                        </p>
                      </div>
                      <div className="merchant-admin-order-total">
                        {formatMoneyMinor(order.totalMinor, order.currencyCode)}
                      </div>
                    </div>

                    <ul className="merchant-admin-order-items">
                      {(order.items ?? []).map((line) => (
                        <li key={line.id}>
                          <span>{line.itemName}</span>
                          <span>
                            x{line.quantity} · {formatMoneyMinor(line.priceMinor, line.currencyCode)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="merchant-admin-order-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={orderActionLoadingId === order.id}
                        onClick={() => handleUpdateOrderStatus(order, "accepted")}
                      >
                        accept
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={orderActionLoadingId === order.id}
                        onClick={() => handleUpdateOrderStatus(order, "preparing")}
                      >
                        prepare
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={orderActionLoadingId === order.id}
                        onClick={() => handleUpdateOrderStatus(order, "ready")}
                      >
                        ready
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={orderActionLoadingId === order.id}
                        onClick={() => handleFinishOrder(order)}
                      >
                        finish
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default MerchantItemsAdmin;
