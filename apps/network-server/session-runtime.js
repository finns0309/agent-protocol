import { buildSessionSnapshot } from "./core/projection.js";
import { createScenarioRegistry } from "./core/scenario-registry.js";
import { SessionManager } from "./core/session-manager.js";

let managerPromise = null;

export async function getSessionManager() {
  if (!managerPromise) {
    managerPromise = (async () => {
      const defaultScenarioId = process.env.DEFAULT_SCENARIO_ID || "";
      const defaultSessionName = process.env.DEFAULT_SESSION_NAME || "";
      const manager = new SessionManager({
        scenarioRegistry: createScenarioRegistry()
      });
      await manager.ensureDefaultSession(defaultScenarioId, defaultSessionName);
      return manager;
    })();
  }

  return managerPromise;
}

export async function getSessionRuntime(sessionId = "") {
  const manager = await getSessionManager();
  const session = manager.get(sessionId);
  if (!session) {
    const error = new Error(`session_not_found:${sessionId}`);
    error.code = "SESSION_NOT_FOUND";
    throw error;
  }
  return session;
}

export async function getSessionSnapshot(sessionId = "") {
  const session = await getSessionRuntime(sessionId);
  return buildSessionSnapshot(session);
}

export async function listScenarios() {
  const manager = await getSessionManager();
  return manager.scenarioRegistry.list();
}

export async function listSessions() {
  const manager = await getSessionManager();
  return manager.list();
}

export async function createSession(spec) {
  const manager = await getSessionManager();
  const session = await manager.create(spec);
  return buildSessionSnapshot(session);
}
