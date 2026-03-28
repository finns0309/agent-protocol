import { executeFinalAction } from "./action-executor.js";
import { buildRecipientsForEnvelope } from "./policy.js";

const MAX_SESSION_ENVELOPES = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shorten(text = "", limit = 160) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1)}…`;
}

function extractMentions(text = "") {
  return String(text || "")
    .match(/@([a-zA-Z0-9_-]+)/g)
    ?.map((value) => value.slice(1).toLowerCase()) || [];
}

function buildFact(prefix, values = {}) {
  const parts = Object.entries(values)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `${key}=${String(value)}`);
  return parts.length ? `${prefix} | ${parts.join(" | ")}` : prefix;
}

function upsertCollaborators(agent, agentIds = []) {
  for (const agentId of agentIds) {
    if (!agentId || agentId === agent.identity.id) {
      continue;
    }
    agent.memory.markCollaborator(agentId);
  }
}

function rememberCommitment(agent, channelId, text, limit = 10) {
  if (!text) {
    return;
  }
  agent.memory.upsertWorkingItem("commitments", text, limit);
}

function rememberDelivery(agent, channelId, text, limit = 8) {
  if (!text) {
    return;
  }
  agent.memory.upsertWorkingItem("deliveries", text, limit);
}

function rememberIncomingTrigger(agent, trigger) {
  const channelId = trigger.channelId || "";
  const summary = shorten(trigger.summary || `${channelId} has new activity`, 140);
  const fact = buildFact(`incoming:${String(trigger.type || "").toLowerCase()}`, {
    channel: channelId || "system",
    actor: trigger.actorId || "",
    message: trigger.messageId || ""
  });
  agent.memory.appendEpisode({
    kind: `incoming_${String(trigger.type || "").toLowerCase()}`,
    channelId,
    text: summary,
    metadata: {
      actorId: trigger.actorId || "",
      messageId: trigger.messageId || ""
    }
  });
  agent.memory.markChannel(channelId);
  agent.memory.upsertWorkingItem("focus", fact, 8);
  upsertCollaborators(agent, [trigger.actorId]);
}

function rememberExecution(agent, trigger, result, execution) {
  if (execution.kind === "send_message" && execution.envelope) {
    const envelope = execution.envelope;
    const text = envelope.payload?.text || "";
    const mentionedIds = extractMentions(text);
    const fact = buildFact(`sent:${String(envelope.type || "").toLowerCase()}`, {
      channel: envelope.channelId,
      message: envelope.id
    });

    agent.memory.appendNote(fact);
    agent.memory.appendEpisode({
      kind: String(envelope.type || "").toLowerCase(),
      channelId: envelope.channelId,
      text: shorten(text, 220),
      metadata: {
        mentionedIds,
        messageId: envelope.id
      }
    });
    agent.memory.markChannel(envelope.channelId);
    agent.memory.upsertWorkingItem("focus", fact, 8);
    upsertCollaborators(agent, mentionedIds);

    if (["OFFER", "ROUTE", "DELIVER", "CONFIRM"].includes(envelope.type)) {
      rememberCommitment(
        agent,
        envelope.channelId,
        buildFact(`commitment:${String(envelope.type || "").toLowerCase()}`, {
          channel: envelope.channelId,
          message: envelope.id
        }),
        10
      );
    }

    if (envelope.type === "DELIVER" || envelope.type === "CONFIRM") {
      rememberDelivery(
        agent,
        envelope.channelId,
        buildFact(`delivery:${String(envelope.type || "").toLowerCase()}`, {
          channel: envelope.channelId,
          message: envelope.id
        }),
        8
      );
    }
    return;
  }

  const passFact = buildFact("pass", {
    trigger: trigger.id,
    channel: trigger.channelId || "system",
    actor: trigger.actorId || ""
  });
  agent.memory.appendNote(passFact);
  agent.memory.appendEpisode({
    kind: "pass",
    channelId: trigger.channelId || "",
    text: shorten(result.trace?.finalAction?.reason || "Chose silence for this turn.", 140),
    metadata: {
      triggerId: trigger.id
    }
  });
}

export function enqueueForMessage(session, envelope) {
  const recipients = buildRecipientsForEnvelope(session, envelope);
  for (const recipient of recipients) {
    const key = `${recipient.agentId}:${envelope.id}`;
    if (session.processed.has(key)) {
      continue;
    }

    const queuedTrigger = {
      agentId: recipient.agentId,
      attempts: 0,
      trigger: {
        id: session.nextId("trigger"),
        type: recipient.triggerType,
        actorId: envelope.from,
        channelId: envelope.channelId,
        messageId: envelope.id,
        summary: `A new message from ${envelope.from} appeared in ${envelope.channelId}`,
        data: {
          ...(recipient.data || {}),
          recipientId: recipient.agentId
        }
      }
    };

    session.processed.add(key);

    if (session.agents.has(recipient.agentId)) {
      session.queue.push(queuedTrigger);
      continue;
    }

    if (typeof session.pushExternalTrigger === "function") {
      session.pushExternalTrigger(recipient.agentId, queuedTrigger.trigger);
    }
  }
}

export async function processQueue(session) {
  if (session.processing) {
    return;
  }

  session.processing = true;
  while (session.running) {
    const next = session.queue.shift();
    if (!next) {
      await sleep(600);
      continue;
    }

    if (session.store.listEnvelopes().length >= MAX_SESSION_ENVELOPES) {
      session.running = false;
      break;
    }

    const agent = session.agents.get(next.agentId);
    if (!agent) {
      continue;
    }

    try {
      if (!next.attempts) {
        rememberIncomingTrigger(agent, next.trigger);
      }
      const result = await agent.handleTrigger(next.trigger);
      session.traceLog.unshift(result.trace);
      session.traceLog = session.traceLog.slice(0, 40);

      const execution = executeFinalAction(session, {
        actorId: agent.identity.id,
        action: result.action,
        trace: result.trace
      });

      rememberExecution(agent, next.trigger, result, execution);
    } catch (error) {
      console.error(`[live-observer] agent ${next.agentId} failed`, error);
      const isRateLimit = String(error?.message || "").includes("429") || String(error?.message || "").includes("rate_limit");
      if (isRateLimit && (next.attempts || 0) < 3) {
        const nextAttempts = (next.attempts || 0) + 1;
        session.queue.unshift({
          ...next,
          attempts: nextAttempts
        });
        await sleep(4000 * nextAttempts);
        continue;
      }
    }

    await sleep(2200);
  }

  session.processing = false;
}
