import { Readable } from "node:stream";

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

const proxyHandler = async (req, res) => {
  const proxyTarget = resolveProxyTarget();
  if (!proxyTarget) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        message: "Missing BACKEND_API_BASE_URL environment variable.",
      }),
    );
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
