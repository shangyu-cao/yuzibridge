import React, { useState } from "react";
import "./merchant-register.css";

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

const TOKEN_KEY = "merchant_admin_token";
const USER_KEY = "merchant_admin_user";
const MEMBERSHIPS_KEY = "merchant_admin_memberships";
const STORE_KEY = "merchant_admin_store_id";

const resolveRegisterErrorMessage = (payload, statusCode) => {
  const message = payload?.message || "";
  if (message === "Email is already registered") {
    return "该邮箱已注册，请直接登录或更换邮箱";
  }
  if (message === "Validation failed") {
    return "注册信息不完整，请检查店铺名、账户名、邮箱和密码";
  }
  if (message) return message;
  if (statusCode === 409) return "该邮箱已注册，请直接登录或更换邮箱";
  return "注册失败";
};

const MerchantRegisterPage = () => {
  const [storeName, setStoreName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedStoreName = storeName.trim();
    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedStoreName) {
      setErrorMessage("店铺名称不能为空");
      return;
    }
    if (!trimmedDisplayName) {
      setErrorMessage("账户名称不能为空");
      return;
    }
    if (!trimmedEmail) {
      setErrorMessage("邮箱不能为空");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("密码至少 8 位");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("两次输入密码不一致");
      return;
    }

    setLoading(true);
    try {
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/api/admin/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            storeName: trimmedStoreName,
            displayName: trimmedDisplayName,
            email: trimmedEmail,
            password,
          }),
        });
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(NETWORK_ERROR_TEXT);
        }
        throw error;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resolveRegisterErrorMessage(payload, response.status));
      }

      localStorage.setItem(TOKEN_KEY, payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
      localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(payload.memberships ?? []));
      localStorage.setItem(STORE_KEY, payload.memberships?.[0]?.store_id ?? "");

      setSuccessMessage("注册成功，正在进入商家后台...");
      window.setTimeout(() => {
        window.location.assign("/merchant-admin");
      }, 600);
    } catch (error) {
      setErrorMessage(error.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="merchant-register-page">
      <div className="merchant-register-card">
        <h1>商家注册</h1>
        <p>创建店铺与管理员账号，完成后可直接进入后台。</p>

        <form onSubmit={handleSubmit} className="merchant-register-form">
          <label>
            店铺名称
            <input
              type="text"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              placeholder="例如：敦悟斋"
              required
            />
          </label>

          <label>
            账户名称
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="例如：张店长"
              required
            />
          </label>

          <label>
            邮箱
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@brand.com"
              required
            />
          </label>

          <div className="merchant-register-password-row">
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 位"
                required
              />
            </label>
            <label>
              确认密码
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次输入密码"
                required
              />
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "注册中..." : "立即注册"}
          </button>
        </form>

        {errorMessage ? <p className="merchant-register-error">{errorMessage}</p> : null}
        {successMessage ? <p className="merchant-register-success">{successMessage}</p> : null}

        <div className="merchant-register-footer">
          <a href="/merchant-admin">已有账号？去登录</a>
          <a href="/">返回官网</a>
        </div>
      </div>
    </div>
  );
};

export default MerchantRegisterPage;
