import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.EMERGE_VIEW_PORT || 4185);
const NETWORK_API_PORT = Number(process.env.NETWORK_API_PORT || process.env.NETWORK_SERVER_PORT || 4190);
const NETWORK_API_BASE = process.env.NETWORK_API_BASE || "";
const BIND_HOST = process.env.EMERGE_BIND_HOST || "";
const OBSERVER_CLIENT_PATH = path.resolve(__dirname, "../../packages/observer-client/src/browser.js");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(body));
}

function resolveNetworkApiBase(req) {
  if (NETWORK_API_BASE) return NETWORK_API_BASE;
  const host = (req?.headers.host || "").split(":")[0] || "127.0.0.1";
  return `http://${host}:${NETWORK_API_PORT}`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      return res.end();
    }

    if (url.pathname === "/api/config") {
      return sendJson(res, 200, { networkApiBase: resolveNetworkApiBase(req), observerMode: "emerge" });
    }

    if (url.pathname === "/__observer-client.js") {
      const content = await readFile(OBSERVER_CLIENT_PATH);
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(content);
    }

    const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(__dirname, safePath);
    if (!filePath.startsWith(__dirname)) return sendJson(res, 403, { error: "forbidden" });

    const ext = path.extname(filePath);
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  } catch (err) {
    const status = err?.code === "ENOENT" ? 404 : 500;
    sendJson(res, status, { error: status === 404 ? "not_found" : "server_error" });
  }
});

server.listen(PORT, BIND_HOST || undefined, () => {
  console.log(`[emerge-view] http://127.0.0.1:${PORT}`);
});
