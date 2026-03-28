function formatList(values = []) {
  return values.length ? values.join(", ") : "none";
}

function formatLabeledList(values = []) {
  if (!values.length) {
    return "none";
  }

  return values.map((value) => `- ${value}`).join("\n");
}

function formatEpisodes(episodes = []) {
  if (!episodes.length) {
    return "none";
  }

  return episodes
    .map((episode) => {
      const prefix = [episode.kind, episode.channelId].filter(Boolean).join(" · ");
      return prefix ? `${prefix}: ${episode.text}` : episode.text;
    })
    .join("\n- ");
}

export class PromptBuilder {
  build({ identity, capabilityProfile, personaPrompt, worldPrompt, memory, trigger, tools }) {
    const memorySnapshot = memory.snapshot();
    const mentionedIds = Array.isArray(trigger.data?.mentionedIds) ? trigger.data.mentionedIds : [];
    const recipientId = trigger.data?.recipientId || "";
    const wasMentioned = recipientId ? mentionedIds.includes(recipientId) : false;
    const safeCapabilities = capabilityProfile || {
      skills: [],
      tools: [],
      preferredTasks: [],
      forbiddenTasks: [],
      resourceNeeds: []
    };
    const triggerFacts = [
      trigger.data?.channelMode ? `Channel mode: ${trigger.data.channelMode}` : "",
      trigger.data?.messageType ? `Message type: ${trigger.data.messageType}` : "",
      trigger.data?.externalAgent ? "The sender is an external agent." : "",
      trigger.data?.isQuestion ? "This message contains a clear question." : "",
      wasMentioned ? "You were explicitly mentioned." : "",
      mentionedIds.length ? `Mentioned in this message: ${mentionedIds.join(", ")}` : ""
    ].filter(Boolean);
    const workingMemory = memorySnapshot.workingMemory || {};

    return {
      system: [
        this.buildProtocolLayer(),
        this.buildWorldLayer(worldPrompt),
        this.buildIdentityLayer(identity, safeCapabilities, personaPrompt)
      ]
        .filter(Boolean)
        .join("\n\n"),
      user: [
        this.buildTriggerContext(trigger, triggerFacts),
        this.buildMemoryContext(memorySnapshot, workingMemory),
        this.buildToolList(tools),
        this.buildOutputInstruction()
      ]
        .filter(Boolean)
        .join("\n")
    };
  }

  buildProtocolLayer() {
    return [
      "You are an agent running inside a Polis network. You will receive triggers from channel messages, system events, and other runtime signals, and you must decide how to respond.",
      "Your operation has two phases:",
      "The first phase is the tool phase. You may only use the real tool names listed below to gather information.",
      "The second phase is the action phase. Once you stop gathering information, you must submit one final action as JSON.",
      "The only valid final action types are: send_message, react, create_channel, open_direct_channel, join_channel, invite_members, leave_channel, pin_message, and pass.",
      "These action types are not tool names. They must never appear in a tool_use call. They belong only in the type field of the final JSON object.",
      "If you call send_message, react, create_channel, open_direct_channel, join_channel, invite_members, leave_channel, pin_message, or pass as a tool, the runtime will return Unknown tool and the turn will fail."
    ].join("\n");
  }

  buildWorldLayer(worldPrompt = "") {
    if (!worldPrompt) {
      return "";
    }

    return `World description: ${worldPrompt}`;
  }

  buildIdentityLayer(identity, capabilityProfile, personaPrompt) {
    return [
      `You are ${identity.displayName}.`,
      identity.role ? `Your role: ${identity.role}.` : "",
      identity.directive ? `Your long-term objective: ${identity.directive}.` : "",
      `Your capability boundaries: skills=${formatList(capabilityProfile.skills)}; preferred_tasks=${formatList(capabilityProfile.preferredTasks)}; forbidden_tasks=${formatList(capabilityProfile.forbiddenTasks)}; required_resources=${formatList(capabilityProfile.resourceNeeds)}.`,
      personaPrompt || ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  buildTriggerContext(trigger, triggerFacts = []) {
    return [
      `You received a trigger: ${trigger.type}`,
      trigger.summary ? `Event summary: ${trigger.summary}` : "Event summary: none",
      trigger.channelId ? `Relevant channel: ${trigger.channelId}` : "",
      trigger.actorId ? `Trigger actor: ${trigger.actorId}` : "",
      triggerFacts.length ? `Additional trigger facts: ${triggerFacts.join("; ")}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  buildMemoryContext(memorySnapshot, workingMemory = {}) {
    return [
      `Compressed memory: ${memorySnapshot.summary || "none"}`,
      "Recent working facts:",
      `Focus traces:\n${formatLabeledList(workingMemory.focus || [])}`,
      `Current commitments:\n${formatLabeledList(workingMemory.commitments || [])}`,
      `Delivery traces:\n${formatLabeledList(workingMemory.deliveries || [])}`,
      `Collaboration traces:\n${formatLabeledList(workingMemory.collaborators || [])}`,
      `Channel traces:\n${formatLabeledList(workingMemory.channels || [])}`,
      `Other open observations:\n${formatLabeledList([
        ...(workingMemory.blockers || []),
        ...(workingMemory.openLoops || [])
      ])}`,
      `Recent private notes:\n${formatLabeledList(memorySnapshot.notes.map((note) => note.text))}`,
      `Recent episodic memory:${memorySnapshot.episodes?.length ? `\n- ${formatEpisodes(memorySnapshot.episodes)}` : " none"}`
    ].join("\n");
  }

  buildToolList(tools = []) {
    const toolNames = tools.map((tool) => tool.name);
    return [
      `The only tools you may call right now are: ${toolNames.length ? toolNames.join(", ") : "none"}`,
      "Any name not listed below is not a tool.",
      "In particular, send_message, react, create_channel, open_direct_channel, join_channel, invite_members, leave_channel, pin_message, and pass can only appear as final action types and must not be called as tools.",
      "Tool list:",
      ...tools.map((tool) => `- ${tool.name}: ${tool.description || "no description"}`)
    ].join("\n");
  }

  buildOutputInstruction() {
    return [
      "Decide for yourself whether you need more information before choosing a final action.",
      "Return exactly one JSON object. Do not output code fences, natural-language explanation, or multiple sections.",
      "You may not call tools in the action phase. Your final assistant response must be an object that can be parsed directly with JSON.parse.",
      "If you decide to send a message, do not call send_message as a tool. Instead, return a JSON object with top-level fields such as type=send_message, channelId, messageType, and text or content.",
      "send_message.messageType must be one of: ANNOUNCE, REQUEST, OFFER, NEGOTIATE, ROUTE, DELIVER, CONFIRM, REACT, SYSTEM.",
      "Action fields must live at the top level of the object. Do not wrap them inside payload.",
      "Valid shapes include:",
      '{"type":"pass","reason":"one short reason"}',
      '{"type":"send_message","channelId":"general","messageType":"REQUEST","text":"message content","reason":"one short reason"}',
      '{"type":"send_message","channelId":"general","messageType":"DELIVER","content":[{"type":"markdown","text":"# Deliverable"}],"reason":"one short reason"}'
    ].join("\n");
  }
}
