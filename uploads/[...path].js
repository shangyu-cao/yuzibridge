import { Readable } from "node:stream";
import app from "../server/app.js";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const resolveProxyTarget = () => {
  const target =
    process.env.BACKEND_API_BASE_URL ||
    process.env.API_PROXY_TARGET ||
    process.env.VITE_API_BASE_URL ||
    "";
  return target.replace(/\/$/, "");
};

const shouldUseLocalApp = (req, proxyTarget) => {
  if (!proxyTarget) return true;
  try {
    const target = new URL(proxyTarget);
    const incomingHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
    if (incomingHost && target.host === incomingHost) return true;
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(target.hostname)) return true;
    return false;
  } catch {
    return true;
  }
};

const proxyHandler = async (req, res) => {
  const proxyTarget = resolveProxyTarget();
  if (shouldUseLocalApp(req, proxyTarget)) {
    app(req, res);
    return;
  }

  const incomingUrl = new URL(req.url, "http://localhost");
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, proxyTarget);

  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers ?? {})) {
      if (!value) continue;
      if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
      if (Array.isArray(value)) headers.set(key, value.join(", "));
      else headers.set(key, value);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
    });

    res.statusCode = response.status;
    for (const [key, value] of response.headers.entries()) {
      if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
      res.setHeader(key, value);
    }

    if (!response.body) {
      const bodyBuffer = Buffer.from(await response.arrayBuffer());
      res.end(bodyBuffer);
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        message: "Upload proxy request failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  }
};

export default proxyHandler;
