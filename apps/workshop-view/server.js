import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorkshopService } from "./backend/workshop-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.WORKSHOP_VIEW_PORT || 4184);
const NETWORK_API_PORT = Number(process.env.NETWORK_API_PORT || process.env.NETWORK_SERVER_PORT || 4190);
const CHAT_VIEW_PORT = Number(process.env.CHAT_VIEW_PORT || process.env.HUMAN_UI_PORT || 4181);
const OPS_VIEW_PORT = Number(process.env.OPS_VIEW_PORT || 4182);
const POLIS_VIEW_PORT = Number(process.env.POLIS_VIEW_PORT || 4285);
const NETWORK_API_BASE = process.env.NETWORK_API_BASE || "";
const POLIS_PUBLIC_HOST = process.env.POLIS_PUBLIC_HOST || process.env.AGORA_PUBLIC_HOST || "";
const POLIS_BIND_HOST = process.env.POLIS_BIND_HOST || process.env.AGORA_BIND_HOST || "";
const OBSERVER_CLIENT_PATH = path.resolve(__dirname, "../../packages/observer-client/src/browser.js");
const workshopService = new WorkshopService();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
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

function getDisplayHost(req) {
  const requestHost = (req?.headers.host || "").split(":")[0];
  return POLIS_PUBLIC_HOST || requestHost || "127.0.0.1";
}

function resolveNetworkApiBase(req) {
  if (NETWORK_API_BASE) {
    return NETWORK_API_BASE;
  }

  return `http://${getDisplayHost(req)}:${NETWORK_API_PORT}`;
}

function resolveViewBase(req, port) {
  return `http://${getDisplayHost(req)}:${port}`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });
      return res.end();
    }

    if (url.pathname === "/api/config") {
      return sendJson(res, 200, {
        networkApiBase: resolveNetworkApiBase(req),
        chatViewBase: resolveViewBase(req, CHAT_VIEW_PORT),
        opsViewBase: resolveViewBase(req, OPS_VIEW_PORT),
        polisViewBase: resolveViewBase(req, POLIS_VIEW_PORT),
        observerMode: "workshop"
      });
    }

    if (url.pathname === "/api/scenarios" && req.method === "GET") {
      return sendJson(res, 200, {
        scenarios: workshopService.listScenarios()
      });
    }

    const scenarioMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)$/);
    if (scenarioMatch && req.method === "GET") {
      const scenarioId = decodeURIComponent(scenarioMatch[1]);
      const scenario = workshopService.getScenario(scenarioId);
      if (!scenario) {
        return sendJson(res, 404, {
          error: "unknown_scenario",
          message: `Unknown scenario: ${scenarioId}`
        });
      }
      return sendJson(res, 200, {
        scenario
      });
    }

    if (url.pathname === "/api/templates" && req.method === "GET") {
      return sendJson(res, 200, {
        templates: workshopService.listTemplates()
      });
    }

    if (url.pathname === "/api/launches" && req.method === "GET") {
      const launches = await workshopService.listLaunches();
      return sendJson(res, 200, {
        launches
      });
    }

    const launchMatch = url.pathname.match(/^\/api\/launches\/([^/]+)$/);
    if (launchMatch && req.method === "GET") {
      const launchId = decodeURIComponent(launchMatch[1]);
      const launch = await workshopService.getLaunch(launchId);
      if (!launch) {
        return sendJson(res, 404, {
          error: "unknown_launch",
          message: `Unknown launch: ${launchId}`
        });
      }
      return sendJson(res, 200, {
        launch
      });
    }

    if (url.pathname === "/api/bootstrap" && req.method === "GET") {
      return sendJson(res, 200, await workshopService.getBootstrap());
    }

    if (url.pathname === "/api/launches" && req.method === "POST") {
      const body = await readJsonBody(req);
      const launch = await workshopService.launchWorld({
        scenarioId: body.scenarioId,
        name: body.name || "",
        observerTemplate: body.observerTemplate,
        observerViews: body.observerViews,
        serverPort: body.serverPort,
        observerPort: body.observerPort
      });

      return sendJson(res, 200, {
        ok: true,
        launch
      });
    }

    const launchActionMatch = url.pathname.match(/^\/api\/launches\/([^/]+)\/(stop|restart)$/);
    if (launchActionMatch && req.method === "POST") {
      const [, launchId, action] = launchActionMatch;
      const launch =
        action === "stop"
          ? await workshopService.stopLaunch(launchId)
          : await workshopService.restartLaunch(launchId);

      return sendJson(res, 200, {
        ok: true,
        launch
      });
    }

    const launchDeleteMatch = url.pathname.match(/^\/api\/launches\/([^/]+)$/);
    if (launchDeleteMatch && req.method === "DELETE") {
      const [, launchId] = launchDeleteMatch;
      await workshopService.removeLaunch(launchId);
      return sendJson(res, 200, {
        ok: true,
        id: launchId
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

server.listen(PORT, POLIS_BIND_HOST || "127.0.0.1", () => {
  const localUrl = `http://127.0.0.1:${PORT}`;
  const publicUrl = `http://${POLIS_PUBLIC_HOST || "127.0.0.1"}:${PORT}`;
  console.log(`[workshop-view] observer server listening on ${localUrl}`);
  if (POLIS_PUBLIC_HOST) {
    console.log(`[workshop-view] share on local network: ${publicUrl}`);
  }
});
