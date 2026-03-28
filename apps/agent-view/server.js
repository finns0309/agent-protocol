import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.AGENT_VIEW_PORT || 4187);
const NETWORK_API_PORT = Number(process.env.NETWORK_API_PORT || process.env.NETWORK_SERVER_PORT || 4190);
const NETWORK_API_BASE = process.env.NETWORK_API_BASE || "";
const BIND_HOST = process.env.AGENT_VIEW_BIND_HOST || process.env.POLIS_BIND_HOST || process.env.AGORA_BIND_HOST || "";
const PUBLIC_HOST = process.env.AGENT_VIEW_PUBLIC_HOST || process.env.POLIS_PUBLIC_HOST || process.env.AGORA_PUBLIC_HOST || "";
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
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function resolveStaticPath(urlPath) {
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) {
    return null;
  }
  return filePath;
}

function resolveNetworkApiBase(req) {
  if (NETWORK_API_BASE) {
    return NETWORK_API_BASE;
  }

  const host = PUBLIC_HOST || (req?.headers.host || "").split(":")[0] || "127.0.0.1";
  return `http://${host}:${NETWORK_API_PORT}`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
      });
      return res.end();
    }

    if (url.pathname === "/api/config") {
      return sendJson(res, 200, {
        networkApiBase: resolveNetworkApiBase(req),
        observerMode: "agent-workbench"
      });
    }

    if (url.pathname === "/__observer-client.js") {
      const content = await readFile(OBSERVER_CLIENT_PATH);
      res.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      });
      return res.end(content);
    }

    const filePath = resolveStaticPath(url.pathname);
    if (!filePath) {
      return sendJson(res, 403, { error: "forbidden" });
    }

    const ext = path.extname(filePath);
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(content);
  } catch (error) {
    const status = error?.code === "ENOENT" ? 404 : 500;
    sendJson(res, status, {
      error: status === 404 ? "not_found" : "server_error",
      message: error?.message || "Unknown error"
    });
  }
});

server.listen(PORT, BIND_HOST || undefined, () => {
  const localUrl = `http://127.0.0.1:${PORT}`;
  const publicUrl = `http://${PUBLIC_HOST || "127.0.0.1"}:${PORT}`;
  console.log(`[agent-view] observer server listening on ${localUrl}`);
  if (PUBLIC_HOST) {
    console.log(`[agent-view] share on local network: ${publicUrl}`);
  }
});
