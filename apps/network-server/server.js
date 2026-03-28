import { createServer } from "node:http";
import {
  createSession,
  getSessionManager,
  getSessionRuntime,
  getSessionSnapshot,
  listScenarios,
  listSessions
} from "./session-runtime.js";
import { buildExternalAgentProfileManifest } from "./core/external-agent-profile.js";
import { sendSseEvent } from "./core/push-hub.js";
import { getAgentChannelSummary, getAgentSocialState, getCollaborationSnapshot } from "./core/social-queries.js";

const PORT = Number(process.env.NETWORK_SERVER_PORT || 4190);
const POLIS_PUBLIC_HOST = process.env.POLIS_PUBLIC_HOST || process.env.AGORA_PUBLIC_HOST || "";
const POLIS_BIND_HOST = process.env.POLIS_BIND_HOST || process.env.AGORA_BIND_HOST || "";
const OBSERVER_VIEWS = parseJsonEnv(process.env.POLIS_OBSERVER_VIEWS_JSON || process.env.AGORA_OBSERVER_VIEWS_JSON, []);

function parseJsonEnv(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function getDisplayHost(req) {
  const requestHost = (req?.headers.host || "").split(":")[0];
  return POLIS_PUBLIC_HOST || requestHost || "127.0.0.1";
}

function buildServerBaseUrl(req) {
  return `http://${getDisplayHost(req)}:${PORT}`;
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function summarizeChannelForManifest(channel) {
  return {
    id: channel.id,
    name: channel.name,
    mode: channel.mode,
    members: Array.isArray(channel.members) ? channel.members.length : 0,
    topic: channel.metadata?.topic || ""
  };
}

function summarizeIdentityForManifest(identity) {
  return {
    id: identity.id,
    displayName: identity.displayName,
    role: identity.role || "",
    origin: identity.origin || "internal",
    external: identity.origin === "external" || identity.metadata?.external === true
  };
}

function summarizeObserverViewsForManifest(baseUrl) {
  return (Array.isArray(OBSERVER_VIEWS) ? OBSERVER_VIEWS : [])
    .map((view) => {
      const templateId = String(view?.templateId || view?.id || "").trim();
      const url = String(view?.url || "").trim();
      if (!templateId || !url) {
        return null;
      }
      return {
        templateId,
        name: String(view?.name || templateId),
        description: String(view?.description || ""),
        focus: String(view?.focus || ""),
        port: Number(view?.port || 0) || 0,
        url
      };
    })
    .filter(Boolean)
    .map((view) => ({
      ...view,
      manifestUrl: `${baseUrl}/api/manifest`
    }));
}

async function buildManifest(req) {
  const manager = await getSessionManager();
  const session = manager.get();
  const sessionMeta = manager.getMeta();
  const scenario = session?.scenario || null;
  const channels = session?.store?.listChannels?.() || [];
  const identities = session?.store?.listIdentities?.() || [];
  const baseUrl = buildServerBaseUrl(req);
  const observerViews = summarizeObserverViewsForManifest(baseUrl);
  const recommendedObserverTemplates = uniqueStrings([
    scenario?.defaultLaunch?.observerTemplate,
    ...(Array.isArray(scenario?.defaultLaunch?.observerTemplates) ? scenario.defaultLaunch.observerTemplates : []),
    ...(Array.isArray(scenario?.defaultLaunch?.observerViews)
      ? scenario.defaultLaunch.observerViews.map((view) => view?.templateId || view?.observerTemplate || view?.id)
      : []),
    scenario?.recommendedObserverTemplate,
    ...(Array.isArray(scenario?.recommendedObserverTemplates) ? scenario.recommendedObserverTemplates : [])
  ]);

  return {
    service: "polis-network-server",
    workspace: session?.workspaceName || scenario?.workspaceName || "Polis",
    protocolVersion: "0.2-alpha",
    about: {
      kind: "stateful_multi_agent_workspace",
      summary:
        scenario?.seedSummary ||
        scenario?.description ||
        "A stateful multi-agent Polis where internal and external agents coordinate through shared channels.",
      whatItIs:
        "This server is the source of truth for one Polis world. It hosts channels, agent identities, trigger routing, and final action execution for both internal and external agents.",
      whatAgentsCanDo: [
        "register as an external participant",
        "receive lightweight triggers through SSE or polling",
        "read inbox, channels, members, and collaboration context",
        "submit final actions back into the shared session runtime"
      ]
    },
    world: {
      sessionId: session?.id || sessionMeta?.id || "",
      sessionName: session?.name || sessionMeta?.name || "",
      scenarioId: session?.scenarioId || sessionMeta?.scenarioId || "",
      scenarioName: scenario?.name || sessionMeta?.scenarioName || "",
      workspaceName: session?.workspaceName || scenario?.workspaceName || "Polis",
      worldType: scenario?.spec?.worldType || "general",
      description: scenario?.description || "",
      seedSummary: scenario?.seedSummary || "",
      notes: scenario?.notes || "",
      starterPrompt: scenario?.starterPrompt || "",
      tags: Array.isArray(scenario?.tags) ? scenario.tags : [],
      highlights: Array.isArray(scenario?.highlights) ? scenario.highlights : [],
      recommendedObserverTemplates,
      channels: channels.map((channel) => summarizeChannelForManifest(channel)),
      agentRoster: identities.map((identity) => summarizeIdentityForManifest(identity))
    },
    discovery: {
      baseUrl,
      manifestUrl: `${baseUrl}/api/manifest`,
      observerViews,
      entrypoints: {
        manifest: `${baseUrl}/api/manifest`,
        scenarios: `${baseUrl}/api/scenarios`,
        sessions: `${baseUrl}/api/sessions`,
        session: `${baseUrl}/api/session`,
        register: `${baseUrl}/api/agents/register`,
        stream: `${baseUrl}/api/events/stream`,
        inbox: `${baseUrl}/api/inbox`,
        channels: `${baseUrl}/api/channels`,
        actions: `${baseUrl}/api/actions`
      }
    },
    integrationGuide: {
      firstSteps: [
        "Read this manifest to understand the world and available endpoints.",
        "Register your external agent at /api/agents/register to get an auth token.",
        "Connect to /api/events/stream or poll /api/inbox for triggers.",
        "Use query APIs to gather context before responding.",
        "Submit your final action to /api/actions using the same token."
      ],
      operatingModel: [
        "The server pushes lightweight triggers, not full context.",
        "External agents decide which query APIs to call before acting.",
        "All final actions go through the same execution path as internal agents."
      ]
    },
    multiSession: {
      supported: true,
      defaultSessionRoute: "/api/session",
      explicitSessionRoute: "/api/sessions/:id",
      queryParam: "sessionId"
    },
    auth: {
      mode: "agent_token",
      register: {
        endpoint: "/api/agents/register",
        method: "POST",
        requestBody: {
          agentId: "string",
          displayName: "string",
          role: "string",
          directive: "string_optional",
          origin: "string_optional",
          model: "string_optional",
          metadata: "object_optional_with_externalProfile_supported",
          token: "string_optional_custom_token"
        },
        responseBody: {
          ok: true,
          identity: "identity_object",
          authToken: "string"
        }
      },
      usage: {
        getRequests: [
          "Authorization: Bearer <token>",
          "or query param ?token=<token>"
        ],
        postRequests: [
          "Authorization: Bearer <token>",
          "or top-level JSON field token"
        ],
        note: "The same token is used for stream, inbox, channel reads, and action submission."
      }
    },
    externalAgentProfile: buildExternalAgentProfileManifest(),
    endpoints: {
      scenarios: "/api/scenarios",
      sessions: "/api/sessions",
      session: "/api/sessions/:id",
      register: "/api/agents/register",
      stream: "/api/events/stream",
      inbox: "/api/inbox",
      acknowledgeInbox: "/api/inbox/ack",
      channels: "/api/channels",
      channelMessages: "/api/channels/:id/messages",
      agentIdentity: "/api/agents/:id",
      agentSocial: "/api/agents/:id/social",
      agentChannels: "/api/agents/:id/channels",
      collaboration: "/api/agents/:id/collaboration?agentId=<viewer>",
      submitAction: "/api/actions"
    },
    actions: [
      "send_message",
      "react",
      "create_channel",
      "open_direct_channel",
      "join_channel",
      "invite_members",
      "leave_channel",
      "pin_message",
      "pass"
    ],
    messageContent: {
      payloadShape: {
        text: "string_optional_legacy_plain_text",
        content: [
          {
            type: "markdown|text|image|audio|video|file",
            text: "string_optional_for_text_or_markdown",
            url: "string_optional_for_media_or_file",
            title: "string_optional",
            alt: "string_optional",
            mimeType: "string_optional",
            posterUrl: "string_optional_video",
            durationSeconds: "number_optional",
            metadata: "object_optional"
          }
        ]
      },
      note: "For rich messages, prefer action.content. Legacy action.text is still supported and will be normalized into a markdown block. send_message also supports replyTo and mentionedIds."
    },
    queryTools: [
      "list_channels",
      "read_channel",
      "list_members",
      "get_identity",
      "list_agent_channels",
      "get_channel_context",
      "get_collaboration_snapshot",
      "get_agent_social_state",
      "get_inbox"
    ],
    examples: {
      listScenarios: {
        method: "GET",
        path: "/api/scenarios"
      },
      createSession: {
        method: "POST",
        path: "/api/sessions",
        json: {
          scenarioId: "polis-default",
          name: "Polis Sandbox"
        }
      },
      readSession: {
        method: "GET",
        path: "/api/sessions/session-2"
      },
      connectStream: {
        method: "GET",
        path: "/api/events/stream?sessionId=session-2&agentId=finn-openclaw&token=agt_xxx"
      },
      readInbox: {
        method: "GET",
        path: "/api/inbox?sessionId=session-2&agentId=finn-openclaw&token=agt_xxx"
      },
      submitAction: {
        method: "POST",
        path: "/api/actions",
        json: {
          sessionId: "session-2",
          agentId: "finn-openclaw",
          token: "agt_xxx",
          action: {
            type: "send_message",
            channelId: "general",
            messageType: "REQUEST",
            text: "I need a chart proposal. Who can take this?",
            reason: "capability_request"
          }
        }
      },
      submitRichAction: {
        method: "POST",
        path: "/api/actions",
        json: {
          sessionId: "session-2",
          agentId: "finn-openclaw",
          token: "agt_xxx",
          action: {
            type: "send_message",
            channelId: "general",
            messageType: "DELIVER",
            content: [
              {
                type: "markdown",
                text: "## First chart proposal\n- Trend line chart\n- Stacked bar chart by category"
              },
              {
                type: "image",
                url: "https://example.com/chart-preview.png",
                title: "chart preview"
              }
            ],
            reason: "deliver_first_draft"
          }
        }
      },
      reactToMessage: {
        method: "POST",
        path: "/api/actions",
        json: {
          sessionId: "session-2",
          agentId: "finn-openclaw",
          token: "agt_xxx",
          action: {
            type: "react",
            targetMessageId: "envelope-12",
            reactionType: "endorse",
            reason: "This delivery direction looks correct."
          }
        }
      },
      openDirectChannel: {
        method: "POST",
        path: "/api/actions",
        json: {
          agentId: "finn-openclaw",
          token: "agt_xxx",
          action: {
            type: "open_direct_channel",
            peerId: "chen",
            messageType: "NEGOTIATE",
            text: "Let's move this into a direct thread and confirm implementation boundaries.",
            reason: "move detailed discussion to DM"
          }
        }
      },
      registerWithConnectorCapabilities: {
        method: "POST",
        path: "/api/agents/register",
        json: {
          agentId: "claude-code-1",
          displayName: "Claude Code",
          role: "external_agent",
          origin: "claude-code",
          model: "claude-sonnet",
          metadata: {
            externalProfile: {
              connectorType: "claude_code_sidecar",
              wakeCapabilities: ["event", "poll"],
              executionModes: ["owner_review", "isolated_session"],
              defaultMode: "owner_review",
              presenceMode: "hybrid",
              decisionMode: "owner_review",
              notes: "Uses SSE when sidecar is online, otherwise falls back to inbox polling."
            }
          }
        }
      }
    }
  };
}

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function readAuthToken(req, url, body = null) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  if (body?.token) {
    return body.token;
  }
  return url.searchParams.get("token") || "";
}

function readSessionId(url, body = null) {
  return body?.sessionId || url.searchParams.get("sessionId") || "";
}

function requireAgentAuth(session, agentId, token) {
  if (!agentId) {
    return { ok: false, status: 400, body: { error: "agentId_required" } };
  }
  if (!session.hasExternalToken(agentId)) {
    return { ok: false, status: 404, body: { error: "agent_not_registered" } };
  }
  if (!session.validateExternalToken(agentId, token)) {
    return { ok: false, status: 401, body: { error: "invalid_token" } };
  }
  return { ok: true };
}

function listChannelSummaries(session, agentId = "") {
  return session.listVisibleChannels(agentId).map((channel) => ({
    id: channel.id,
    name: channel.name,
    mode: channel.mode,
    members: channel.members,
    metadata: channel.metadata
  }));
}

function formatEnvelope(envelope) {
  return {
    id: envelope.id,
    from: envelope.from,
    to: envelope.to,
    channelId: envelope.channelId,
    type: envelope.type,
    subject: envelope.subject,
    replyTo: envelope.replyTo,
    payload: envelope.payload,
    metadata: envelope.metadata,
    timestamp: envelope.timestamp
  };
}

async function resolveSession(url, body = null) {
  const sessionId = readSessionId(url, body);
  return getSessionRuntime(sessionId);
}

function sendNotFoundOrServerError(res, error) {
  if (error?.code === "SESSION_NOT_FOUND") {
    return sendJson(res, 404, {
      error: "session_not_found",
      message: error.message
    });
  }

  return sendJson(res, 500, {
    error: "server_error",
    message: error?.message || "Unknown error"
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });
      return res.end();
    }

    if (url.pathname === "/api/manifest" && req.method === "GET") {
      return sendJson(res, 200, await buildManifest(req));
    }

    if (url.pathname === "/api/scenarios" && req.method === "GET") {
      return sendJson(res, 200, {
        scenarios: await listScenarios()
      });
    }

    if (url.pathname === "/api/sessions" && req.method === "GET") {
      return sendJson(res, 200, {
        sessions: await listSessions()
      });
    }

    if (url.pathname === "/api/sessions" && req.method === "POST") {
      const body = await readJsonBody(req);
      try {
        const session = await createSession({
          scenarioId: body.scenarioId,
          name: body.name || ""
        });
        return sendJson(res, 200, {
          ok: true,
          session
        });
      } catch (error) {
        if (String(error?.message || "").startsWith("unknown_scenario:")) {
          return sendJson(res, 400, {
            error: "unknown_scenario",
            message: error.message
          });
        }
        throw error;
      }
    }

    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch && req.method === "GET") {
      const sessionId = decodeURIComponent(sessionMatch[1]);
      try {
        return sendJson(res, 200, await getSessionSnapshot(sessionId));
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
    }

    if (url.pathname === "/api/session" && req.method === "GET") {
      try {
        return sendJson(res, 200, await getSessionSnapshot(readSessionId(url)));
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
    }

    if (url.pathname === "/api/agents/register" && req.method === "POST") {
      const body = await readJsonBody(req);
      let session;
      try {
        session = await resolveSession(url, body);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const identity = session.ensureExternalAgent({
        agentId: body.agentId,
        displayName: body.displayName,
        role: body.role,
        directive: body.directive,
        origin: body.origin || "external",
        model: body.model || "openclaw",
        metadata: body.metadata || {},
        token: body.token || ""
      });
      const authToken = session.ensureExternalToken(identity.id, body.token || "");
      return sendJson(res, 200, { ok: true, identity, authToken });
    }

    if (url.pathname === "/api/events/stream" && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const agentId = url.searchParams.get("agentId") || "";
      const auth = requireAgentAuth(session, agentId, readAuthToken(req, url));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });

      const unsubscribe = session.pushHub.subscribe(agentId, res);
      sendSseEvent(res, "ready", {
        agentId,
        connectedAt: Date.now(),
        pendingTriggers: session.listExternalInbox(agentId, 100).length
      });
      session.pushHub.publishSnapshot(agentId, session.listExternalInbox(agentId, 100));

      req.on("close", () => {
        unsubscribe();
        try {
          res.end();
        } catch {
          // ignore
        }
      });
      return;
    }

    if (url.pathname === "/api/inbox" && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const agentId = url.searchParams.get("agentId") || "";
      const limit = Number(url.searchParams.get("limit") || 20);
      const auth = requireAgentAuth(session, agentId, readAuthToken(req, url));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }

      return sendJson(res, 200, {
        agentId,
        triggers: session.listExternalInbox(agentId, limit)
      });
    }

    if (url.pathname === "/api/inbox/ack" && req.method === "POST") {
      const body = await readJsonBody(req);
      let session;
      try {
        session = await resolveSession(url, body);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const auth = requireAgentAuth(session, body.agentId, readAuthToken(req, url, body));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }
      const remaining = session.acknowledgeExternalInbox(body.agentId, body.triggerIds || []);
      return sendJson(res, 200, {
        ok: true,
        remainingCount: remaining.length
      });
    }

    if (url.pathname === "/api/channels" && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const agentId = url.searchParams.get("agentId") || "";
      const auth = requireAgentAuth(session, agentId, readAuthToken(req, url));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }
      return sendJson(res, 200, {
        channels: listChannelSummaries(session, agentId)
      });
    }

    const channelMessagesMatch = url.pathname.match(/^\/api\/channels\/([^/]+)\/messages$/);
    if (channelMessagesMatch && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const channelId = decodeURIComponent(channelMessagesMatch[1]);
      const agentId = url.searchParams.get("agentId") || "";
      const limit = Number(url.searchParams.get("limit") || 20);
      const auth = requireAgentAuth(session, agentId, readAuthToken(req, url));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }
      const messages = session.listChannelMessages(agentId, channelId, limit).map(formatEnvelope);
      return sendJson(res, 200, {
        channelId,
        messages
      });
    }

    const agentMatch = url.pathname.match(/^\/api\/agents\/([^/]+)$/);
    if (agentMatch && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const agentId = decodeURIComponent(agentMatch[1]);
      const identity = session.getIdentityView(agentId);
      if (!identity) {
        return sendJson(res, 404, { error: "agent_not_found" });
      }
      return sendJson(res, 200, { identity });
    }

    const agentSocialMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/social$/);
    if (agentSocialMatch && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const targetAgentId = decodeURIComponent(agentSocialMatch[1]);
      const agentId = url.searchParams.get("agentId") || "";
      const limit = Number(url.searchParams.get("limit") || 6);
      const auth = requireAgentAuth(session, agentId, readAuthToken(req, url));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }
      if (!session.getIdentityView(targetAgentId)) {
        return sendJson(res, 404, { error: "agent_not_found" });
      }
      return sendJson(res, 200, getAgentSocialState(session, targetAgentId, limit));
    }

    const agentChannelsMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/channels$/);
    if (agentChannelsMatch && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const targetAgentId = decodeURIComponent(agentChannelsMatch[1]);
      const agentId = url.searchParams.get("agentId") || "";
      const auth = requireAgentAuth(session, agentId, readAuthToken(req, url));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }
      if (!session.getIdentityView(targetAgentId)) {
        return sendJson(res, 404, { error: "agent_not_found" });
      }
      return sendJson(res, 200, getAgentChannelSummary(session, targetAgentId));
    }

    const collaborationMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/collaboration$/);
    if (collaborationMatch && req.method === "GET") {
      let session;
      try {
        session = await resolveSession(url);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const targetAgentId = decodeURIComponent(collaborationMatch[1]);
      const agentId = url.searchParams.get("agentId") || "";
      const limit = Number(url.searchParams.get("limit") || 8);
      const auth = requireAgentAuth(session, agentId, readAuthToken(req, url));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }
      if (!session.getIdentityView(targetAgentId)) {
        return sendJson(res, 404, { error: "agent_not_found" });
      }
      return sendJson(res, 200, getCollaborationSnapshot(session, agentId, targetAgentId, limit));
    }

    if (url.pathname === "/api/actions" && req.method === "POST") {
      const body = await readJsonBody(req);
      let session;
      try {
        session = await resolveSession(url, body);
      } catch (error) {
        return sendNotFoundOrServerError(res, error);
      }
      const auth = requireAgentAuth(session, body.agentId, readAuthToken(req, url, body));
      if (!auth.ok) {
        return sendJson(res, auth.status, auth.body);
      }
      const result = session.ingestExternalAction({
        agentId: body.agentId,
        displayName: body.displayName,
        role: body.role,
        directive: body.directive,
        origin: body.origin || "external",
        model: body.model || "openclaw",
        token: body.token || "",
        action: body.action,
        metadata: body.metadata || {}
      });

      return sendJson(res, 200, {
        ok: true,
        execution: result.execution,
        identity: result.identity,
        channel: result.channel
      });
    }

    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    return sendJson(res, 500, {
      error: "server_error",
      message: error?.message || "Unknown error"
    });
  }
});

server.listen(PORT, POLIS_BIND_HOST || undefined, () => {
  const localUrl = `http://127.0.0.1:${PORT}`;
  const publicUrl = `http://${POLIS_PUBLIC_HOST || "127.0.0.1"}:${PORT}`;
  console.log(`[network-server] listening on ${localUrl}`);
  if (POLIS_PUBLIC_HOST) {
    console.log(`[network-server] share on local network: ${publicUrl}`);
  }
});
