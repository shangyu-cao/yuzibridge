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

const METHOD_WITHOUT_BODY = new Set(["GET", "HEAD"]);

const normalizeRequestUrl = (req) => {
  const incomingUrl = new URL(req.url, "http://localhost");
  const rewrittenPath =
    incomingUrl.searchParams.get("path") ?? incomingUrl.searchParams.get("...path");

  if (!rewrittenPath) {
    return;
  }

  const normalizedPath = String(rewrittenPath).replace(/^\/+/, "");
  incomingUrl.pathname = `/api/${normalizedPath}`;
  incomingUrl.searchParams.delete("path");
  incomingUrl.searchParams.delete("...path");
  req.url = `${incomingUrl.pathname}${incomingUrl.search}`;
};

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

const copyRequestHeaders = (req) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else headers.set(key, value);
  }
  return headers;
};

const copyResponseHeaders = (response, res) => {
  for (const [key, value] of response.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    res.setHeader(key, value);
  }
};

const proxyHandler = async (req, res) => {
  normalizeRequestUrl(req);

  const proxyTarget = resolveProxyTarget();
  if (shouldUseLocalApp(req, proxyTarget)) {
    app(req, res);
    return;
  }

  const incomingUrl = new URL(req.url, "http://localhost");
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, proxyTarget);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: copyRequestHeaders(req),
      body: METHOD_WITHOUT_BODY.has(req.method) ? undefined : req,
      duplex: METHOD_WITHOUT_BODY.has(req.method) ? undefined : "half",
    });

    res.statusCode = response.status;
    copyResponseHeaders(response, res);

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
        message: "Proxy request failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  }
};

export default proxyHandler;
