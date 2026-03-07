import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./merchant-admin.css";

const resolveApiBaseUrl = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)) {
      return "http://localhost:4000";
    }
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:4000";
};

const API_BASE_URL = resolveApiBaseUrl();
const NETWORK_ERROR_TEXT = `无法连接后端服务（${API_BASE_URL}）`;
const MENU_PUBLIC_BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin.replace(/\/$/, "")
    : API_BASE_URL;

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

const COMMON_CURRENCY_OPTIONS = [
  "CNY",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "KRW",
  "SGD",
  "HKD",
  "AUD",
  "CAD",
];

const ORDER_STATUS_LABEL = {
  new: "新订单",
  accepted: "已接受",
  preparing: "准备中",
  ready: "已准备",
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

const EMPTY_STORE_FORM = {
  brandName: "",
  logoUrl: "",
  addressText: "",
  contactPhone: "",
  contactEmail: "",
};

const EMPTY_ACCOUNT_FORM = {
  displayName: "",
  email: "",
  createdAt: "",
  lastLoginAt: "",
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
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

const normalizeStoreForm = (store) => ({
  brandName: store?.brandName ?? "",
  logoUrl: store?.logoUrl ?? "",
  addressText: store?.addressText ?? "",
  contactPhone: store?.contactPhone ?? "",
  contactEmail: store?.contactEmail ?? "",
});

const normalizeAccountForm = (user, accountMeta) => ({
  displayName: user?.displayName ?? "",
  email: user?.email ?? "",
  createdAt: accountMeta?.createdAt ?? "",
  lastLoginAt: accountMeta?.lastLoginAt ?? "",
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
});

const normalizeTableRows = (payload) => (Array.isArray(payload?.tables) ? payload.tables : []);

const toAbsoluteMenuUrl = (targetUrl) => {
  const normalized = String(targetUrl ?? "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${MENU_PUBLIC_BASE_URL}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
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

  const [activeTab, setActiveTab] = useState("items");

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [allergenOptions, setAllergenOptions] = useState(DEFAULT_ALLERGEN_OPTIONS);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");
  const [itemStatusFilter, setItemStatusFilter] = useState("all");
  const [priceSort, setPriceSort] = useState("none");
  const [draggingCategoryId, setDraggingCategoryId] = useState("");
  const [dropHint, setDropHint] = useState({ categoryId: "", position: "before" });
  const [categorySortSaving, setCategorySortSaving] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState("");
  const [itemDropHint, setItemDropHint] = useState({ itemId: "", position: "before" });
  const [itemSortSaving, setItemSortSaving] = useState(false);
  const [tableArea, setTableArea] = useState("a");
  const [tableCount, setTableCount] = useState("8");
  const [tableGenerating, setTableGenerating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [storeSubmitLoading, setStoreSubmitLoading] = useState(false);
  const [accountSubmitLoading, setAccountSubmitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [orderActionLoadingId, setOrderActionLoadingId] = useState("");
  const [finishConfirmOrder, setFinishConfirmOrder] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [toast, setToast] = useState(null);

  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [storeForm, setStoreForm] = useState(EMPTY_STORE_FORM);
  const [accountForm, setAccountForm] = useState(() => normalizeAccountForm(user, null));
  const [isPasswordEditorOpen, setIsPasswordEditorOpen] = useState(false);
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);

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

  const canReorderItems =
    searchKeyword.trim() === "" &&
    activeCategoryFilter !== "all" &&
    itemStatusFilter === "all" &&
    priceSort === "none";

  const showToast = useCallback((type, message) => {
    if (!message) return;
    setToast({ type, message, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fetchWithAuth = useCallback(
    async (path, options = {}) => {
      let response;
      try {
        response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers ?? {}),
          },
        });
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(NETWORK_ERROR_TEXT);
        }
        throw error;
      }

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
    if (!token) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const accountResp = await fetchWithAuth("/api/admin/auth/me");

      if (accountResp?.user) {
        setUser(accountResp.user);
        localStorage.setItem(USER_KEY, JSON.stringify(accountResp.user));
      }
      if (Array.isArray(accountResp?.memberships)) {
        setMemberships(accountResp.memberships);
        localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(accountResp.memberships));
      }
      setAccountForm(normalizeAccountForm(accountResp?.user, accountResp?.accountMeta));

      if (!selectedStoreId) {
        setStoreForm(EMPTY_STORE_FORM);
        setCategories([]);
        setItems([]);
        setOrders([]);
        setTables([]);
        setAllergenOptions(DEFAULT_ALLERGEN_OPTIONS);
        return;
      }

      const [storeResp, categoryResp, itemResp, allergenResp, orderResp, tableResp] = await Promise.all([
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/profile`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/categories`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/allergens`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/orders`),
        fetchWithAuth(`/api/admin/stores/${selectedStoreId}/tables`),
      ]);

      setStoreForm(normalizeStoreForm(storeResp));
      setCategories(categoryResp?.categories ?? []);
      setItems(itemResp?.items ?? []);
      setOrders(orderResp?.orders ?? []);
      setTables(normalizeTableRows(tableResp));
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

  useEffect(() => {
    setAccountForm((current) => ({
      ...current,
      displayName: current.displayName || user?.displayName || "",
      email: current.email || user?.email || "",
    }));
  }, [user]);

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

  const openCategoryCreator = () => {
    resetCategoryForm();
    setIsCategoryEditorOpen(true);
  };

  const openItemCreator = () => {
    resetItemForm();
    setIsItemEditorOpen(true);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(NETWORK_ERROR_TEXT);
        }
        throw error;
      }

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
      setAccountForm(normalizeAccountForm(payload.user, payload.accountMeta ?? null));
      setIsPasswordEditorOpen(false);

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
    setTables([]);
    setStoreForm(EMPTY_STORE_FORM);
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setIsPasswordEditorOpen(false);
    setIsCategoryEditorOpen(false);
    setIsItemEditorOpen(false);
    clearCategoryDragState();
    clearItemDragState();
    resetItemForm();
    resetCategoryForm();
    setSuccessMessage("已退出登录");
    setErrorMessage("");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(MEMBERSHIPS_KEY);
    localStorage.removeItem(STORE_KEY);
    window.location.assign("/");
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
    setStoreForm(EMPTY_STORE_FORM);
    setTables([]);
    setTableArea("a");
    setTableCount("8");
    setAccountForm((current) => ({
      ...current,
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    }));
    setIsPasswordEditorOpen(false);
    setIsCategoryEditorOpen(false);
    setIsItemEditorOpen(false);
    clearCategoryDragState();
    clearItemDragState();
  };

  const handleAllergenToggle = (allergenCode) => {
    setItemForm((current) => {
      const set = new Set(current.allergenCodes ?? []);
      if (set.has(allergenCode)) set.delete(allergenCode);
      else set.add(allergenCode);

      return { ...current, allergenCodes: [...set] };
    });
  };

  const uploadImageFile = async (file) => {
    if (!file) return;
    if (!selectedStoreId) {
      throw new Error("请先选择店铺");
    }

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
    return payload.imageUrl ?? "";
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const imageUrl = await uploadImageFile(file);
      setItemForm((current) => ({ ...current, imageUrl }));
      setSuccessMessage("图片上传成功");
    } catch (error) {
      setErrorMessage(error.message || "上传图片失败");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleStoreLogoUpload = async (file) => {
    if (!file) return;
    setUploadLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const imageUrl = await uploadImageFile(file);
      setStoreForm((current) => ({ ...current, logoUrl: imageUrl }));
      setSuccessMessage("商铺头像上传成功，请点击保存");
      showToast("success", "商铺头像上传成功");
    } catch (error) {
      setErrorMessage(error.message || "上传商铺头像失败");
      showToast("error", error.message || "上传商铺头像失败");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm(normalizeItemForm(item));
    setIsItemEditorOpen(true);
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
      if (editingItemId === item.id) {
        resetItemForm();
        setIsItemEditorOpen(false);
      }
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
      setIsItemEditorOpen(false);
    } catch (error) {
      setErrorMessage(error.message || "保存失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm(normalizeCategoryForm(category));
    setIsCategoryEditorOpen(true);
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
      if (editingCategoryId === category.id) {
        resetCategoryForm();
        setIsCategoryEditorOpen(false);
      }
    } catch (error) {
      setErrorMessage(error.message || "删除分类失败（请先删除分类下菜品）");
    }
  };

  const persistCategoryOrder = async (nextCategories, options = {}) => {
    const fromDrag = Boolean(options.fromDrag);
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

      const message = fromDrag ? "分类顺序已自动保存" : "分类顺序已保存";
      setSuccessMessage(message);
      showToast("success", message);
      await loadData();
    } catch (error) {
      const message = error.message || "保存分类顺序失败";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setCategorySortSaving(false);
    }
  };

  const clearCategoryDragState = () => {
    setDraggingCategoryId("");
    setDropHint({ categoryId: "", position: "before" });
  };

  const handleCategoryDragStart = (categoryId) => {
    setDraggingCategoryId(categoryId);
    setDropHint({ categoryId: "", position: "before" });
  };

  const handleCategoryDragOver = (event, targetCategoryId) => {
    event.preventDefault();
    if (!draggingCategoryId || draggingCategoryId === targetCategoryId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropHint((current) => {
      if (current.categoryId === targetCategoryId && current.position === position) return current;
      return { categoryId: targetCategoryId, position };
    });
  };

  const handleCategoryDrop = async (targetCategoryId) => {
    const position = dropHint.categoryId === targetCategoryId ? dropHint.position : "before";
    if (!draggingCategoryId || draggingCategoryId === targetCategoryId) {
      clearCategoryDragState();
      return;
    }

    const sourceIndex = categories.findIndex((category) => category.id === draggingCategoryId);
    const targetIndex = categories.findIndex((category) => category.id === targetCategoryId);
    if (sourceIndex < 0 || targetIndex < 0) {
      clearCategoryDragState();
      return;
    }

    const reordered = [...categories];
    const [moved] = reordered.splice(sourceIndex, 1);
    let insertIndex = targetIndex + (position === "after" ? 1 : 0);
    if (sourceIndex < insertIndex) insertIndex -= 1;
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > reordered.length) insertIndex = reordered.length;
    if (sourceIndex === insertIndex) {
      clearCategoryDragState();
      return;
    }
    reordered.splice(insertIndex, 0, moved);
    setCategories(reordered);
    clearCategoryDragState();
    await persistCategoryOrder(reordered, { fromDrag: true });
  };

  const persistItemOrder = async (nextItems, options = {}) => {
    const fromDrag = Boolean(options.fromDrag);
    if (!selectedStoreId || !nextItems.length) {
      return;
    }

    setItemSortSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      for (let index = 0; index < nextItems.length; index += 1) {
        const item = nextItems[index];
        const nextSortOrder = (index + 1) * 10;
        await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/items/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ sortOrder: nextSortOrder }),
        });
      }
      const message = fromDrag ? "菜品顺序已自动保存" : "菜品顺序已保存";
      setSuccessMessage(message);
      showToast("success", message);
      await loadData();
    } catch (error) {
      const message = error.message || "保存菜品顺序失败";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setItemSortSaving(false);
    }
  };

  const clearItemDragState = () => {
    setDraggingItemId("");
    setItemDropHint({ itemId: "", position: "before" });
  };

  const handleItemDragStart = (itemId) => {
    if (!canReorderItems) return;
    setDraggingItemId(itemId);
    setItemDropHint({ itemId: "", position: "before" });
  };

  const handleItemDragOver = (event, targetItemId) => {
    if (!canReorderItems) return;
    event.preventDefault();
    if (!draggingItemId || draggingItemId === targetItemId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setItemDropHint((current) => {
      if (current.itemId === targetItemId && current.position === position) return current;
      return { itemId: targetItemId, position };
    });
  };

  const handleItemDrop = async (targetItemId) => {
    if (!canReorderItems) {
      clearItemDragState();
      return;
    }

    const position = itemDropHint.itemId === targetItemId ? itemDropHint.position : "before";
    if (!draggingItemId || draggingItemId === targetItemId) {
      clearItemDragState();
      return;
    }

    const categoryItems = filteredItems;
    const sourceIndex = categoryItems.findIndex((item) => item.id === draggingItemId);
    const targetIndex = categoryItems.findIndex((item) => item.id === targetItemId);
    if (sourceIndex < 0 || targetIndex < 0) {
      clearItemDragState();
      return;
    }

    const reorderedCategoryItems = [...categoryItems];
    const [moved] = reorderedCategoryItems.splice(sourceIndex, 1);
    let insertIndex = targetIndex + (position === "after" ? 1 : 0);
    if (sourceIndex < insertIndex) insertIndex -= 1;
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > reorderedCategoryItems.length) insertIndex = reorderedCategoryItems.length;
    if (sourceIndex === insertIndex) {
      clearItemDragState();
      return;
    }
    reorderedCategoryItems.splice(insertIndex, 0, moved);
    setItems((currentItems) => {
      let cursor = 0;
      return currentItems.map((item) => {
        if (item.categoryId !== activeCategoryFilter) {
          return item;
        }
        const nextItem = reorderedCategoryItems[cursor];
        cursor += 1;
        return nextItem ?? item;
      });
    });
    clearItemDragState();
    await persistItemOrder(reorderedCategoryItems, { fromDrag: true });
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
      setIsCategoryEditorOpen(false);
    } catch (error) {
      setErrorMessage(error.message || "保存分类失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGenerateTables = async (event) => {
    event.preventDefault();
    if (!selectedStoreId) {
      setErrorMessage("请先选择店铺");
      return;
    }

    const normalizedArea = tableArea.trim().toLowerCase();
    const count = Number.parseInt(tableCount, 10);
    if (!/^[a-z]+$/.test(normalizedArea)) {
      setErrorMessage("区域只能输入英文字母，例如 a 或 b");
      return;
    }
    if (!Number.isFinite(count) || count < 1 || count > 200) {
      setErrorMessage("桌数需为 1 - 200 的整数");
      return;
    }

    setTableGenerating(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/tables/generate`, {
        method: "POST",
        body: JSON.stringify({
          area: normalizedArea,
          count,
        }),
      });
      setTables(normalizeTableRows(response));
      setSuccessMessage(`已生成 ${normalizedArea}1 - ${normalizedArea}${count} 桌号`);
      showToast("success", `已生成 ${count} 个桌号`);
    } catch (error) {
      const message = error.message || "生成桌号失败";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setTableGenerating(false);
    }
  };

  const handleSubmitStoreProfile = async (event) => {
    event.preventDefault();
    if (!selectedStoreId) {
      setErrorMessage("请先选择店铺");
      return;
    }

    setStoreSubmitLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        brandName: storeForm.brandName.trim(),
        logoUrl: storeForm.logoUrl.trim() || null,
        addressText: storeForm.addressText.trim() || null,
        contactPhone: storeForm.contactPhone.trim() || null,
        contactEmail: storeForm.contactEmail.trim() || null,
      };
      if (!payload.brandName) {
        throw new Error("商铺名称不能为空");
      }
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/profile`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSuccessMessage("商铺信息已更新");
      showToast("success", "商铺信息已更新");
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "保存商铺信息失败");
      showToast("error", error.message || "保存商铺信息失败");
    } finally {
      setStoreSubmitLoading(false);
    }
  };

  const handleSubmitAccount = async (event) => {
    event.preventDefault();
    setAccountSubmitLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const currentPassword = accountForm.currentPassword.trim();
      const newPassword = accountForm.newPassword.trim();
      const confirmNewPassword = accountForm.confirmNewPassword.trim();

      if (!newPassword && !confirmNewPassword && !currentPassword) {
        throw new Error("请先输入密码信息");
      }
      if (newPassword.length < 8) {
        throw new Error("新密码至少 8 位");
      }
      if (newPassword !== confirmNewPassword) {
        throw new Error("两次输入的新密码不一致");
      }
      if (!currentPassword) {
        throw new Error("修改密码时需要填写当前密码");
      }

      const payload = {
        currentPassword,
        newPassword,
      };

      const response = await fetchWithAuth("/api/admin/auth/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setToken(response.token);
      setUser(response.user);
      setMemberships(response.memberships ?? []);
      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(response.memberships ?? []));

      const hasSelectedStore = (response.memberships ?? []).some(
        (membership) => membership.store_id === selectedStoreId,
      );
      if (!hasSelectedStore) {
        const fallbackStoreId = response.memberships?.[0]?.store_id ?? "";
        setSelectedStoreId(fallbackStoreId);
        localStorage.setItem(STORE_KEY, fallbackStoreId);
      }

      setAccountForm((current) => ({
        ...current,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      setIsPasswordEditorOpen(false);

      setSuccessMessage("密码已更新");
      showToast("success", "密码已更新");
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "修改密码失败");
      showToast("error", error.message || "修改密码失败");
    } finally {
      setAccountSubmitLoading(false);
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

  const handleOpenFinishConfirm = (order) => {
    setFinishConfirmOrder(order);
  };

  const handleCloseFinishConfirm = () => {
    if (finishConfirmOrder && orderActionLoadingId === finishConfirmOrder.id) return;
    setFinishConfirmOrder(null);
  };

  const handleConfirmFinishOrder = async () => {
    if (!finishConfirmOrder) return;
    const order = finishConfirmOrder;
    setOrderActionLoadingId(order.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await fetchWithAuth(`/api/admin/stores/${selectedStoreId}/orders/${order.id}`, {
        method: "DELETE",
      });
      setSuccessMessage(`订单 ${order.tableCode ?? "-"} 已完成并移除`);
      setFinishConfirmOrder(null);
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
            <p>
              {user?.displayName ? `${user.displayName} · ` : ""}
              {user?.email ?? ""}
            </p>
          </div>

          <div className="merchant-admin-header-actions">
            <label className="merchant-admin-inline-label">
              店铺
              <select value={selectedStoreId} onChange={(event) => handleStoreChange(event.target.value)}>
                {memberships.map((membership) => (
                  <option key={membership.store_id} value={membership.store_id}>
                    {membership.store_brand_name ?? membership.store_slug ?? membership.store_id.slice(0, 8)} (
                    {membership.role})
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
            className={activeTab === "account" ? "secondary active-filter" : "secondary"}
            onClick={() => setActiveTab("account")}
          >
            账户管理
          </button>
          <button
            type="button"
            className={activeTab === "store" ? "secondary active-filter" : "secondary"}
            onClick={() => setActiveTab("store")}
          >
            商铺管理
          </button>
          <button
            type="button"
            className={activeTab === "categories" ? "secondary active-filter" : "secondary"}
            onClick={() => setActiveTab("categories")}
          >
            分类管理
          </button>
          <button
            type="button"
            className={activeTab === "tables" ? "secondary active-filter" : "secondary"}
            onClick={() => setActiveTab("tables")}
          >
            桌号管理
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

        {activeTab === "account" ? (
          <section className="merchant-admin-card">
            <div className="merchant-admin-table-header">
              <h2>账户资料</h2>
              <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                {loading ? "刷新中..." : "刷新"}
              </button>
            </div>
            <form
              onSubmit={(event) => {
                if (!isPasswordEditorOpen) {
                  event.preventDefault();
                  return;
                }
                handleSubmitAccount(event);
              }}
              className="merchant-admin-form"
            >
              <label>
                账户名
                <input type="text" value={accountForm.displayName} readOnly />
              </label>

              <label>
                邮箱
                <input type="email" value={accountForm.email} readOnly />
              </label>

              <div className="merchant-admin-row">
                <label>
                  注册时间
                  <input type="text" value={formatDatetime(accountForm.createdAt)} readOnly />
                </label>
                <label>
                  最近登录
                  <input type="text" value={formatDatetime(accountForm.lastLoginAt)} readOnly />
                </label>
              </div>

              <div className="merchant-admin-account-memberships">
                <h3>所属商铺与角色</h3>
                {!memberships.length ? (
                  <p className="merchant-admin-empty">暂无商铺权限</p>
                ) : (
                  <ul>
                    {memberships.map((membership) => (
                      <li key={membership.store_id}>
                        <span>
                          {membership.store_brand_name ?? membership.store_slug ?? membership.store_id}
                        </span>
                        <span className="merchant-admin-role-chip">{membership.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setIsPasswordEditorOpen((current) => !current);
                  if (isPasswordEditorOpen) {
                    setAccountForm((current) => ({
                      ...current,
                      currentPassword: "",
                      newPassword: "",
                      confirmNewPassword: "",
                    }));
                  }
                }}
              >
                {isPasswordEditorOpen ? "取消修改密码" : "修改密码"}
              </button>

              {isPasswordEditorOpen ? (
                <div className="merchant-admin-account-password-box">
                  <h3>修改密码</h3>
                  <div className="merchant-admin-row">
                    <label>
                      当前密码
                      <input
                        type="password"
                        value={accountForm.currentPassword}
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      新密码
                      <input
                        type="password"
                        value={accountForm.newPassword}
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            newPassword: event.target.value,
                          }))
                        }
                        placeholder="至少 8 位"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    确认新密码
                    <input
                      type="password"
                      value={accountForm.confirmNewPassword}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          confirmNewPassword: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <div className="merchant-admin-form-actions">
                    <button type="submit" disabled={accountSubmitLoading}>
                      {accountSubmitLoading ? "保存中..." : "确认修改密码"}
                    </button>
                  </div>
                </div>
              ) : null}
            </form>
          </section>
        ) : null}

        {activeTab === "store" ? (
          <section className="merchant-admin-card">
            <div className="merchant-admin-table-header">
              <h2>商铺资料</h2>
              <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                {loading ? "刷新中..." : "刷新"}
              </button>
            </div>
            <form onSubmit={handleSubmitStoreProfile} className="merchant-admin-form">
              <label>
                商铺名称
                <input
                  type="text"
                  value={storeForm.brandName}
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, brandName: event.target.value }))
                  }
                  required
                />
              </label>

              <div className="merchant-admin-row">
                <label>
                  商铺头像
                  <input
                    className="merchant-admin-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploadLoading}
                    onChange={(event) => handleStoreLogoUpload(event.target.files?.[0])}
                  />
                  <small className="merchant-admin-help">
                    {uploadLoading ? "上传中..." : "支持 jpeg/png/webp/gif，最大 5MB"}
                  </small>
                </label>
              </div>

              {storeForm.logoUrl ? (
                <div className="merchant-admin-image-preview store-logo-preview">
                  <img src={storeForm.logoUrl} alt="store-logo-preview" />
                </div>
              ) : null}

              <label>
                商铺地址
                <textarea
                  rows={3}
                  value={storeForm.addressText}
                  onChange={(event) =>
                    setStoreForm((current) => ({ ...current, addressText: event.target.value }))
                  }
                />
              </label>

              <div className="merchant-admin-row">
                <label>
                  联系电话
                  <input
                    type="text"
                    value={storeForm.contactPhone}
                    onChange={(event) =>
                      setStoreForm((current) => ({ ...current, contactPhone: event.target.value }))
                    }
                    placeholder="+86 ..."
                  />
                </label>
                <label>
                  联系邮箱
                  <input
                    type="email"
                    value={storeForm.contactEmail}
                    onChange={(event) =>
                      setStoreForm((current) => ({ ...current, contactEmail: event.target.value }))
                    }
                    placeholder="contact@yourstore.com"
                  />
                </label>
              </div>

              <div className="merchant-admin-form-actions">
                <button type="submit" disabled={storeSubmitLoading}>
                  {storeSubmitLoading ? "保存中..." : "保存商铺信息"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === "tables" ? (
          <section className="merchant-admin-card">
            <div className="merchant-admin-table-header">
              <h2>桌号管理</h2>
              <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                {loading ? "刷新中..." : "刷新"}
              </button>
            </div>

            <form onSubmit={handleGenerateTables} className="merchant-admin-table-generator">
              <label>
                区域
                <input
                  type="text"
                  value={tableArea}
                  onChange={(event) => setTableArea(event.target.value)}
                  placeholder="例如 a 或 b"
                  maxLength={20}
                  required
                />
              </label>
              <label>
                桌数
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={tableCount}
                  onChange={(event) => setTableCount(event.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={tableGenerating}>
                {tableGenerating ? "生成中..." : "生成桌号"}
              </button>
            </form>

            {!tables.length ? (
              <p className="merchant-admin-empty">暂无桌号，请先输入区域和桌数生成。</p>
            ) : (
              <div className="merchant-admin-table-wrap">
                <table className="merchant-admin-table">
                  <thead>
                    <tr>
                      <th>桌号</th>
                      <th>链接</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map((table) => (
                      <tr key={table.id ?? table.tableCode}>
                        <td>{table.tableCode}</td>
                        <td>
                          <a
                            href={toAbsoluteMenuUrl(table.targetUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="merchant-admin-link"
                          >
                            {toAbsoluteMenuUrl(table.targetUrl)}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "categories" ? (
          <div className={`merchant-admin-split ${isCategoryEditorOpen ? "with-editor" : ""}`}>
            <section className="merchant-admin-card merchant-admin-split-main">
              <div className="merchant-admin-table-header">
                <h2>分类列表（拖拽排序）</h2>
                <div className="merchant-admin-table-header-actions">
                  <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                    {loading ? "刷新中..." : "刷新"}
                  </button>
                  <button type="button" className="secondary" onClick={openCategoryCreator}>
                    新增分类
                  </button>
                </div>
              </div>
              <p className="merchant-admin-drag-tip">
                拖拽分类可自动保存顺序：放到条目上半区=插入前，下半区=插入后。
                {categorySortSaving ? "（保存中...）" : ""}
              </p>

              {!categories.length ? (
                <p className="merchant-admin-empty">暂无分类</p>
              ) : (
                <ul className={`merchant-admin-category-list ${draggingCategoryId ? "is-sorting" : ""}`}>
                  {categories.map((category, index) => (
                    <li
                      key={category.id}
                      className={`merchant-admin-category-item ${
                        draggingCategoryId === category.id ? "dragging" : ""
                      } ${
                        dropHint.categoryId === category.id ? `drop-${dropHint.position}` : ""
                      }`}
                      draggable
                      onDragStart={() => handleCategoryDragStart(category.id)}
                      onDragOver={(event) => handleCategoryDragOver(event, category.id)}
                      onDrop={() => handleCategoryDrop(category.id)}
                      onDragEnd={clearCategoryDragState}
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

            {isCategoryEditorOpen ? (
              <section className="merchant-admin-card merchant-admin-split-side">
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
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setIsCategoryEditorOpen(false);
                        resetCategoryForm();
                      }}
                    >
                      取消
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
          </div>
        ) : null}

        {activeTab === "items" ? (
          <div className={`merchant-admin-split ${isItemEditorOpen ? "with-editor" : ""}`}>
            <section className="merchant-admin-card merchant-admin-split-main">
              <div className="merchant-admin-table-header">
                <h2>菜品列表</h2>
                <div className="merchant-admin-table-header-actions">
                  <button type="button" className="secondary" onClick={loadData} disabled={loading}>
                    {loading ? "刷新中..." : "刷新"}
                  </button>
                  <button type="button" className="secondary" onClick={openItemCreator}>
                    新增菜品
                  </button>
                </div>
              </div>

              <div className="merchant-admin-search-panel">
                <label className="merchant-admin-search-box">
                  <span className="merchant-admin-search-box-label">搜索</span>
                  <input
                    className="merchant-admin-search-input"
                    type="search"
                    placeholder="输入菜品名称 / 描述 / 过敏源"
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                  />
                </label>

                <div className="merchant-admin-filter-group">
                  <label>
                    分类
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
                  </label>

                  <label>
                    状态
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
                  </label>

                  <label>
                    价格
                    <select
                      className="merchant-admin-filter-select"
                      value={priceSort}
                      onChange={(event) => setPriceSort(event.target.value)}
                    >
                      <option value="none">默认</option>
                      <option value="asc">价格从低到高</option>
                      <option value="desc">价格从高到低</option>
                    </select>
                  </label>
                </div>
              </div>

              <p className="merchant-admin-drag-tip">
                {canReorderItems
                  ? "拖拽菜品可自动保存顺序：放到条目上半区=插入前，下半区=插入后。"
                  : "仅在按分类查看菜品时可拖拽排序；状态筛选、价格排序或搜索时不可拖拽。"}
                {itemSortSaving ? "（保存中...）" : ""}
              </p>

              {!filteredItems.length ? (
                <p className="merchant-admin-empty">暂无菜品</p>
              ) : (
                <div className="merchant-admin-table-wrap">
                  <table className={`merchant-admin-table ${canReorderItems ? "is-reorderable" : ""}`}>
                    <thead>
                      <tr>
                        <th>排序</th>
                        <th>名称</th>
                        <th>分类</th>
                        <th>价格</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          className={`${draggingItemId === item.id ? "dragging" : ""} ${
                            itemDropHint.itemId === item.id ? `drop-${itemDropHint.position}` : ""
                          }`}
                          draggable={canReorderItems}
                          onDragStart={() => handleItemDragStart(item.id)}
                          onDragOver={(event) => handleItemDragOver(event, item.id)}
                          onDrop={() => handleItemDrop(item.id)}
                          onDragEnd={clearItemDragState}
                        >
                          <td className="merchant-admin-item-grip-cell">
                            <span className="merchant-admin-item-grip" title="拖拽调整顺序">
                              ≡
                            </span>
                          </td>
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

            {isItemEditorOpen ? (
              <section className="merchant-admin-card merchant-admin-split-side">
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
                        type="text"
                        inputMode="decimal"
                        placeholder="例如 58.00"
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
                        list="merchant-admin-currency-options"
                        value={itemForm.currencyCode}
                        onChange={(event) =>
                          setItemForm((current) => ({ ...current, currencyCode: event.target.value }))
                        }
                        placeholder="输入或选择货币代码"
                        required
                      />
                      <datalist id="merchant-admin-currency-options">
                        {COMMON_CURRENCY_OPTIONS.map((currencyCode) => (
                          <option key={currencyCode} value={currencyCode} />
                        ))}
                      </datalist>
                    </label>
                  </div>

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
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setIsItemEditorOpen(false);
                        resetItemForm();
                      }}
                    >
                      取消
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
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
                        接受订单
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={orderActionLoadingId === order.id}
                        onClick={() => handleUpdateOrderStatus(order, "preparing")}
                      >
                        准备中
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={orderActionLoadingId === order.id}
                        onClick={() => handleUpdateOrderStatus(order, "ready")}
                      >
                        已准备
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={orderActionLoadingId === order.id}
                        onClick={() => handleOpenFinishConfirm(order)}
                      >
                        结束订单
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
      {finishConfirmOrder ? (
        <div className="merchant-admin-modal-backdrop" role="presentation" onClick={handleCloseFinishConfirm}>
          <div
            className="merchant-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-order-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="finish-order-modal-title">确认结束订单</h3>
            <p>
              确认结束订单（桌号: {finishConfirmOrder.tableCode || "-"}）吗？
              <br />
              结束后订单将从列表移除。
            </p>
            <div className="merchant-admin-modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={orderActionLoadingId === finishConfirmOrder.id}
                onClick={handleCloseFinishConfirm}
              >
                取消
              </button>
              <button
                type="button"
                className="danger"
                disabled={orderActionLoadingId === finishConfirmOrder.id}
                onClick={handleConfirmFinishOrder}
              >
                {orderActionLoadingId === finishConfirmOrder.id ? "处理中..." : "确定"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <div className={`merchant-admin-toast ${toast.type}`}>{toast.message}</div> : null}
    </div>
  );
};

export default MerchantItemsAdmin;
