import { spawn } from "node:child_process";
import { Socket, createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createObserverTemplateRegistry } from "./backend/observer-template-registry.js";

const LAUNCH_BIND_HOST = process.env.POLIS_LAUNCH_BIND_HOST || process.env.AGORA_LAUNCH_BIND_HOST || "0.0.0.0";
const LAUNCH_PUBLIC_HOST =
  process.env.POLIS_LAUNCH_PUBLIC_HOST ||
  process.env.AGORA_LAUNCH_PUBLIC_HOST ||
  resolvePreferredLanHost() ||
  "127.0.0.1";

function toObserverViewSummary(view) {
  return {
    id: view.templateId,
    templateId: view.templateId,
    name: view.name,
    description: view.description || "",
    focus: view.focus || "",
    port: view.port,
    url: view.url,
    status: view.status || "stopped"
  };
}

function buildObserverUrls(observerViews = []) {
  return Object.fromEntries(
    observerViews.map((view) => [view.templateId, view.url])
  );
}

function toLaunchSummary(record) {
  const observerViews = Array.isArray(record.observerViews)
    ? record.observerViews.map((view) => toObserverViewSummary(view))
    : [];
  const primaryView = observerViews[0] || null;
  return {
    id: record.id,
    name: record.name,
    scenarioId: record.scenarioId,
    scenarioName: record.scenarioName,
    observerTemplate: primaryView?.templateId || "",
    observerTemplates: observerViews.map((view) => view.templateId),
    serverPort: record.serverPort,
    observerPort: primaryView?.port || 0,
    observerViews,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
    urls: {
      networkApi: record.urls?.networkApi || "",
      manifest: record.urls?.manifest || "",
      observer: primaryView?.url || "",
      observers: buildObserverUrls(observerViews)
    },
    restartable: true,
    stoppable: record.status === "running" || record.status === "starting"
  };
}

function resolvePreferredLanHost() {
  const interfaces = os.networkInterfaces();
  const preferredRanges = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[0-1])\./];

  const candidates = Object.values(interfaces)
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);

  for (const range of preferredRanges) {
    const match = candidates.find((address) => range.test(address));
    if (match) {
      return match;
    }
  }

  return candidates[0] || "";
}

function toLaunchRecord(record) {
  const primaryView = Array.isArray(record.observerViews) ? record.observerViews[0] || null : null;
  return {
    ...toLaunchSummary(record),
    runtime: {
      pid: record.serverProcess?.pid || null,
      observerPid: primaryView?.process?.pid || null,
      observerPids: (record.observerViews || []).map((view) => ({
        templateId: view.templateId,
        pid: view.process?.pid || null
      }))
    }
  };
}

function asPortNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeObserverViewSpecs(
  { observerViews = [], observerTemplate = "", observerPort, serverPort },
  observerTemplateRegistry
) {
  const requestedViews =
    Array.isArray(observerViews) && observerViews.length
      ? observerViews
      : observerTemplate || observerPort
        ? [
            {
              templateId: observerTemplate,
              port: observerPort
            }
          ]
        : [];

  if (!requestedViews.length) {
    throw new Error("observer_view_required");
  }

  const normalizedServerPort = asPortNumber(serverPort);
  const seenTemplateIds = new Set();
  const seenPorts = new Set([normalizedServerPort]);

  return requestedViews.map((view, index) => {
    const templateId = String(view?.templateId || view?.observerTemplate || view?.id || "").trim();
    if (!templateId) {
      throw new Error(`observer_template_required:${index}`);
    }
    if (seenTemplateIds.has(templateId)) {
      throw new Error(`duplicate_observer_template:${templateId}`);
    }

    const template = observerTemplateRegistry.get(templateId);
    if (!template) {
      throw new Error(`unknown_observer_template:${templateId}`);
    }

    const fallbackPort = normalizedServerPort ? normalizedServerPort + index + 1 : 0;
    const port = asPortNumber(view?.port ?? view?.observerPort, fallbackPort);
    if (!port) {
      throw new Error(`observer_port_required:${templateId}`);
    }
    if (seenPorts.has(port)) {
      throw new Error(`duplicate_launch_port:${port}`);
    }

    seenTemplateIds.add(templateId);
    seenPorts.add(port);

    return {
      templateId,
      name: template.name,
      description: template.description || "",
      focus: template.focus || "",
      scriptPath: template.scriptPath,
      envPortKey: template.envPortKey,
      port,
      url: `http://${LAUNCH_PUBLIC_HOST}:${port}`,
      status: "stopped",
      process: null
    };
  });
}

function stopProcess(processRef) {
  if (processRef && !processRef.killed) {
    processRef.kill();
  }
}

function stopObserverProcesses(record) {
  for (const view of record.observerViews || []) {
    stopProcess(view.process);
  }
}

function resetObserverProcesses(record) {
  for (const view of record.observerViews || []) {
    view.process = null;
    view.status = "stopped";
  }
}

function listLaunchPorts(record) {
  return [record.serverPort, ...(record.observerViews || []).map((view) => view.port)];
}

async function ensurePortsFree(ports = []) {
  const checks = await Promise.all(ports.map((port) => canBindPort(port)));
  checks.forEach((isFree, index) => {
    if (!isFree) {
      throw new Error(`launch_port_in_use:${ports[index]}`);
    }
  });
}

async function waitForPortsFree(ports = []) {
  await Promise.allSettled(
    ports.map((port) => waitForPortFree(port))
  );
}

async function canBindPort(port, host = LAUNCH_BIND_HOST) {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => {
      resolve(false);
    });
    probe.listen(port, host, () => {
      probe.close(() => resolve(true));
    });
  });
}

async function waitForPort(port, host = "127.0.0.1", timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const reachable = await new Promise((resolve) => {
      const socket = new Socket();
      const done = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(600);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
      socket.connect(port, host);
    });
    if (reachable) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`port_not_ready:${port}`);
}

async function waitForPortFree(port, host = LAUNCH_BIND_HOST, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canBindPort(port, host)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`port_not_released:${port}`);
}

function spawnServerProcess(scriptPath, env) {
  return spawn(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
    stdio: "ignore"
  });
}

export class LaunchManager {
  constructor({ observerTemplateRegistry = createObserverTemplateRegistry() } = {}) {
    this.observerTemplateRegistry = observerTemplateRegistry;
    this.launches = new Map();
    this.nextLaunchNumber = 1;
    this.cleanupRegistered = false;
  }

  listTemplates() {
    return this.observerTemplateRegistry.list();
  }

  listLaunches() {
    return Array.from(this.launches.values())
      .map((record) => toLaunchSummary(record))
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  getLaunch(launchId) {
    return this.launches.get(launchId) || null;
  }

  getLaunchSummary(launchId) {
    const record = this.getLaunch(launchId);
    return record ? toLaunchSummary(record) : null;
  }

  getLaunchRecord(launchId) {
    const record = this.getLaunch(launchId);
    return record ? toLaunchRecord(record) : null;
  }

  registerCleanup() {
    if (this.cleanupRegistered) {
      return;
    }
    this.cleanupRegistered = true;
    const shutdown = () => {
      for (const record of this.launches.values()) {
        stopProcess(record.serverProcess);
        stopObserverProcesses(record);
      }
    };
    process.once("exit", shutdown);
    process.once("SIGINT", () => {
      shutdown();
      process.exit(0);
    });
    process.once("SIGTERM", () => {
      shutdown();
      process.exit(0);
    });
  }

  async stopLaunch(launchId) {
    const record = this.getLaunch(launchId);
    if (!record) {
      throw new Error(`unknown_launch:${launchId}`);
    }

    record.status = "stopping";
    record.updatedAt = Date.now();

    stopObserverProcesses(record);
    stopProcess(record.serverProcess);

    await waitForPortsFree(listLaunchPorts(record));

    record.status = "stopped";
    record.updatedAt = Date.now();
    record.serverProcess = null;
    resetObserverProcesses(record);
    return toLaunchSummary(record);
  }

  async startLaunchRecord(record) {
    record.status = "starting";
    record.updatedAt = Date.now();

    const serverProcess = spawnServerProcess(
      path.resolve(process.cwd(), "apps/network-server/server.js"),
      {
        NETWORK_SERVER_PORT: String(record.serverPort),
        DEFAULT_SCENARIO_ID: record.scenarioId,
        DEFAULT_SESSION_NAME: record.name,
        POLIS_OBSERVER_VIEWS_JSON: JSON.stringify(
          record.observerViews.map((view) => toObserverViewSummary(view))
        ),
        POLIS_BIND_HOST: LAUNCH_BIND_HOST,
        POLIS_PUBLIC_HOST: LAUNCH_PUBLIC_HOST
      }
    );
    record.serverProcess = serverProcess;

    serverProcess.once("exit", () => {
      if (record.serverProcess === serverProcess) {
        record.serverProcess = null;
        record.status = "stopped";
        record.updatedAt = Date.now();
      }
    });

    try {
      await waitForPort(record.serverPort);
    } catch (error) {
      record.status = "failed";
      record.updatedAt = Date.now();
      stopProcess(serverProcess);
      throw error;
    }

    try {
      for (const view of record.observerViews) {
        view.status = "starting";
        const observerProcess = spawnServerProcess(view.scriptPath, {
          [view.envPortKey]: String(view.port),
          NETWORK_API_BASE: `http://${LAUNCH_PUBLIC_HOST}:${record.serverPort}`,
          POLIS_BIND_HOST: LAUNCH_BIND_HOST,
          POLIS_PUBLIC_HOST: LAUNCH_PUBLIC_HOST
        });
        view.process = observerProcess;

        observerProcess.once("exit", () => {
          if (view.process === observerProcess) {
            view.process = null;
            view.status = "stopped";
            record.status = "stopped";
            record.updatedAt = Date.now();
          }
        });

        await waitForPort(view.port);
        view.status = "running";
      }
    } catch (error) {
      record.status = "failed";
      record.updatedAt = Date.now();
      stopObserverProcesses(record);
      stopProcess(serverProcess);
      resetObserverProcesses(record);
      throw error;
    }

    record.status = "running";
    record.updatedAt = Date.now();
    return toLaunchSummary(record);
  }

  async restartLaunch(launchId) {
    const record = this.getLaunch(launchId);
    if (!record) {
      throw new Error(`unknown_launch:${launchId}`);
    }

    if (record.status === "running" || record.status === "starting") {
      await this.stopLaunch(launchId);
    }

    await ensurePortsFree(listLaunchPorts(record));
    return this.startLaunchRecord(record);
  }

  async removeLaunch(launchId) {
    const record = this.getLaunch(launchId);
    if (!record) {
      throw new Error(`unknown_launch:${launchId}`);
    }
    if (record.status !== "stopped") {
      throw new Error(`launch_not_stopped:${launchId}`);
    }

    this.launches.delete(launchId);
    return { id: launchId };
  }

  async launch({ scenarioId, scenarioName = "", serverPort, observerTemplate, observerPort, observerViews, name = "" }) {
    const normalizedServerPort = Number(serverPort);
    if (!normalizedServerPort) {
      throw new Error("port_required");
    }

    const normalizedObserverViews = normalizeObserverViewSpecs(
      {
        observerViews,
        observerTemplate,
        observerPort,
        serverPort: normalizedServerPort
      },
      this.observerTemplateRegistry
    );

    this.registerCleanup();

    const id = `launch-${this.nextLaunchNumber++}`;
    const record = {
      id,
      name: name || `${scenarioName || scenarioId} @ ${normalizedServerPort}`,
      scenarioId,
      scenarioName: scenarioName || scenarioId,
      serverPort: normalizedServerPort,
      observerViews: normalizedObserverViews,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "starting",
      urls: {
        networkApi: `http://${LAUNCH_PUBLIC_HOST}:${normalizedServerPort}`,
        manifest: `http://${LAUNCH_PUBLIC_HOST}:${normalizedServerPort}/api/manifest`
      },
      serverProcess: null
    };
    this.launches.set(id, record);

    try {
      await ensurePortsFree(listLaunchPorts(record));
      return await this.startLaunchRecord(record);
    } catch (error) {
      this.launches.delete(id);
      throw error;
    }
  }
}
