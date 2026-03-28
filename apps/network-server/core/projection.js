import { ChannelModes, extractTextFromPayload } from "../../../packages/protocol/src/index.js";
import { colorForAgent } from "./constants.js";
import {
  buildSocialOverview,
  getAgentChannelSummary,
  getAgentSocialState,
  getTotalReputationScore
} from "./social-queries.js";

function lowerType(type) {
  return String(type || "chat").toLowerCase();
}

function shortenText(text = "", limit = 72) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function formatChannelLabel(channelId = "") {
  const normalized = String(channelId || "").trim();
  if (!normalized) {
    return "system";
  }
  if (normalized.startsWith("dm-")) {
    return normalized.replace(/^dm-/, "dm:");
  }
  return `#${normalized.replace(/^#/, "")}`;
}

function summarizeAction(trace) {
  const finalAction = trace.finalAction || {};

  switch (finalAction.type) {
    case "send_message": {
      const responseType = lowerType(finalAction.messageType || "chat");
      return {
        decisionVerb: responseType === "route" ? "routed" : "responded",
        decisionType: responseType,
        decisionSummary: "",
        tone: responseType === "deliver" || responseType === "confirm" ? "deliver" : "respond"
      };
    }

    case "pass":
      return {
        decisionVerb: "passed",
        decisionType: "no action",
        decisionSummary: shortenText(finalAction.reason || "evaluated but chose not to engage", 56),
        tone: "pass"
      };

    case "create_channel":
      return {
        decisionVerb: "created",
        decisionType: "channel",
        decisionSummary: shortenText(finalAction.metadata?.name || finalAction.channelId || "opened a new channel", 64),
        tone: "system"
      };

    case "open_direct_channel":
      return {
        decisionVerb: "opened",
        decisionType: "dm",
        decisionSummary: shortenText(
          finalAction.peerId ? `started a private thread with ${finalAction.peerId}` : finalAction.reason || "opened direct channel",
          64
        ),
        tone: "system"
      };

    case "join_channel":
      return {
        decisionVerb: "joined",
        decisionType: "channel",
        decisionSummary: shortenText(finalAction.channelId || "joined channel", 64),
        tone: "system"
      };

    case "leave_channel":
      return {
        decisionVerb: "left",
        decisionType: "channel",
        decisionSummary: shortenText(finalAction.channelId || "left channel", 64),
        tone: "system"
      };

    case "invite_members":
      return {
        decisionVerb: "invited",
        decisionType: "members",
        decisionSummary: shortenText((finalAction.members || []).join(", ") || "updated channel membership", 64),
        tone: "system"
      };

    case "pin_message":
      return {
        decisionVerb: "pinned",
        decisionType: "message",
        decisionSummary: shortenText(finalAction.messageId || finalAction.targetMessageId || "pinned an item", 64),
        tone: "system"
      };

    case "react":
      return {
        decisionVerb: "reacted",
        decisionType: lowerType(finalAction.reactionType || "react"),
        decisionSummary: shortenText(finalAction.reason || "left a reaction", 64),
        tone: "respond"
      };

    default:
      return {
        decisionVerb: "acted",
        decisionType: lowerType(finalAction.type || "action"),
        decisionSummary: shortenText(finalAction.reason || "", 64),
        tone: toolCallCount ? "respond" : "system"
      };
  }
}

function formatTrace(trace) {
  if (!trace) {
    return null;
  }

  const durationMs = Math.max(0, (trace.finishedAt || Date.now()) - (trace.startedAt || Date.now()));
  return {
    title: `reasoning trace  ·  ${trace.toolCalls.length} tool calls  ·  ${(durationMs / 1000).toFixed(1)}s`,
    steps: [
      {
        label: "trigger",
        value: `${trace.trigger.type}${trace.trigger.channelId ? ` in ${trace.trigger.channelId}` : ""}${trace.trigger.actorId ? ` — from: ${trace.trigger.actorId}` : ""}`
      },
      ...trace.toolCalls.flatMap((toolCall) => [
        { label: "tool", value: `${toolCall.tool}(${JSON.stringify(toolCall.input)})`, kind: "tool" },
        {
          label: "result",
          value: JSON.stringify(toolCall.output).slice(0, 220)
        }
      ]),
      trace.finalAction?.reason
        ? {
            label: "think",
            value: `"${trace.finalAction.reason}"`,
            tone: "muted"
          }
        : null,
      {
        label: "action",
        value: `${trace.finalAction?.type || "pass"}${trace.finalAction?.channelId ? ` · ${trace.finalAction.channelId}` : ""}`,
        kind: "tool"
      }
    ].filter(Boolean)
  };
}

function formatChannel(session, channel) {
  const envelopes = session.store.listEnvelopes({ channelId: channel.id });
  const reactions = session.store
    .listReactions()
    .filter((reaction) => reaction.channelId === channel.id)
    .map((reaction) => {
      const actorIdentity = session.store.getIdentity(reaction.actor);
      const targetIdentity = session.store.getIdentity(reaction.target);
      return {
        id: reaction.id,
        actorId: reaction.actor,
        actorName: actorIdentity?.displayName || reaction.actor,
        avatar: (actorIdentity?.displayName || reaction.actor).slice(0, 1).toUpperCase(),
        avatarColor: colorForAgent(reaction.actor),
        targetId: reaction.target,
        targetName: targetIdentity?.displayName || reaction.target,
        reactionType: reaction.type,
        summary: reaction.summary,
        envelopeId: reaction.envelopeId || reaction.data?.targetMessageId || "",
        timestamp: new Date(reaction.timestamp).toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }),
        rawTimestamp: reaction.timestamp || Date.now(),
        data: reaction.data || {}
      };
    });
  return {
    id: channel.id,
    label: channel.name,
    prefix: channel.mode === ChannelModes.DIRECT ? "dm" : "#",
    visibility: channel.metadata?.visibility || (channel.mode === ChannelModes.DIRECT ? "private" : "public"),
    members: channel.members.length,
    topic: channel.metadata?.topic || "",
    pinnedMessageIds: channel.metadata?.pinnedMessageIds || [],
    lastPinnedMessageId: channel.metadata?.lastPinnedMessageId || "",
    systemMessage: channel.mode === ChannelModes.GROUP ? "new activity detected" : "direct message thread",
    reactions,
    messages: envelopes.map((envelope) => {
      const identity = session.store.getIdentity(envelope.from);
      return {
        id: envelope.id,
        actorId: envelope.from,
        actorName: identity?.displayName || envelope.from,
        avatar: (identity?.displayName || envelope.from).slice(0, 1).toUpperCase(),
        avatarColor: colorForAgent(envelope.from),
        timestamp: new Date(envelope.timestamp).toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }),
        rawTimestamp: envelope.timestamp,
        type: lowerType(envelope.type),
        replyTo: envelope.replyTo || "",
        mentionedIds: envelope.metadata?.mentionedIds || [],
        text: extractTextFromPayload(envelope.payload),
        content: envelope.payload?.content || [],
        trace: formatTrace(session.tracesByMessageId.get(envelope.id))
      };
    })
  };
}

function buildSidebar(session) {
  const channels = session.store.listChannels();
  return {
    channels: channels
      .filter((channel) => channel.mode === ChannelModes.GROUP)
      .map((channel) => ({
        id: channel.id,
        label: channel.name,
        prefix: "#",
        count: channel.members.length
      })),
    directMessages: channels
      .filter((channel) => channel.mode === ChannelModes.DIRECT)
      .map((channel) => ({
        id: channel.id,
        label: channel.name,
        members: channel.members.map((memberId) => {
          const identity = session.store.getIdentity(memberId);
          return {
            avatar: identity?.displayName?.slice(0, 1)?.toUpperCase() || "?",
            color: colorForAgent(memberId)
          };
        })
      })),
    meetings: [
      {
        id: "meeting-sprint-planning",
        label: "Sprint planning",
        live: true
      }
    ]
  };
}

function buildAgentStats(session) {
  const envelopes = session.store.listEnvelopes();
  return session.store.listIdentities().map((identity) => {
    const agentMessages = envelopes.filter((envelope) => envelope.from === identity.id);
    const toolCalls = session.traceLog
      .filter((trace) => trace.agentId === identity.id)
      .reduce((sum, trace) => sum + trace.toolCalls.length, 0);
    const capabilities = identity.metadata?.capabilityProfile?.skills || [];
    const socialState = getAgentSocialState(session, identity.id, 6);
    const channelSummary = getAgentChannelSummary(session, identity.id);

    return {
      id: identity.id,
      name: identity.displayName,
      role: identity.role.replaceAll("_", " "),
      active: session.queue.some((entry) => entry.agentId === identity.id),
      color: colorForAgent(identity.id),
      stats: {
        messages: agentMessages.length,
        tools: toolCalls,
        channels: channelSummary.channelCount
      },
      capabilities,
      connector: identity.metadata?.externalProfile || null,
      social: {
        onboarding: socialState.onboarding
          ? {
              presenceState: socialState.onboarding.presenceState,
              trustState: socialState.onboarding.trustState,
              integrationOutcome: socialState.onboarding.integrationOutcome
            }
          : null,
        reputationScore: getTotalReputationScore(session, identity.id),
        reactionCount: session.store.listReactions({ target: identity.id }).length
      }
    };
  });
}

function buildEventLog(session) {
  const traces = session.traceLog.slice(0, 12);
  return traces.map((trace) => {
    const summary = summarizeAction(trace);
    const channelId = trace.finalAction?.channelId || trace.trigger.channelId || "";
    const toolCallCount = Array.isArray(trace.toolCalls) ? trace.toolCalls.length : 0;
    return {
      time: new Date(trace.finishedAt || trace.startedAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
      }),
      agent: trace.agentName,
      agentId: trace.agentId,
      color: colorForAgent(trace.agentId),
      channelId,
      channelLabel: formatChannelLabel(channelId),
      triggerType: trace.trigger?.type || "",
      triggerActorId: trace.trigger?.actorId || "",
      triggerMessageId: trace.trigger?.messageId || "",
      actionType: trace.finalAction?.type || "pass",
      decisionVerb: summary.decisionVerb,
      decisionType: summary.decisionType,
      decisionSummary: summary.decisionSummary,
      toolCallCount,
      tone: summary.tone,
      text: `${summary.decisionVerb} · ${summary.decisionType}${summary.decisionSummary ? ` · ${summary.decisionSummary}` : ""}`,
      badge: toolCallCount ? `${toolCallCount} tool calls` : "",
      badgeTone: toolCallCount ? "tool" : ""
    };
  });
}

export function buildSessionSnapshot(session) {
  const channels = session.store.listChannels();
  return {
    session: {
      id: session.id,
      name: session.name,
      scenarioId: session.scenarioId,
      createdAt: session.createdAt
    },
    workspace: {
      name: session.workspaceName || "Polis"
    },
    sidebar: buildSidebar(session),
    channels: channels.map((channel) => formatChannel(session, channel)),
    agents: buildAgentStats(session),
    social: buildSocialOverview(session, 10),
    networkEvents: buildEventLog(session),
    updatedAt: session.lastUpdatedAt || Date.now()
  };
}
