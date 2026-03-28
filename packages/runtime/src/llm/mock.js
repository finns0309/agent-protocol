import { createFinalAction, FinalActionTypes } from "../action.js";
import { extractTextFromPayload } from "../../../protocol/src/content.js";
import { LLMAdapter } from "./adapter.js";

export class MockToolUsingAdapter extends LLMAdapter {
  constructor({ strategy } = {}) {
    super();
    this.strategy = strategy || defaultStrategy;
  }

  async respond(request) {
    return this.strategy(request);
  }
}

async function defaultStrategy({ trigger, tools }) {
  const readChannel = tools.find((tool) => tool.name === "read_channel");
  const getIdentity = tools.find((tool) => tool.name === "get_identity");
  const listMembers = tools.find((tool) => tool.name === "list_members");

  let lastMessages = [];
  let sender = null;
  let members = [];

  if (readChannel && trigger.channelId) {
    const result = await readChannel.execute({
      channelId: trigger.channelId,
      limit: 5
    });
    lastMessages = result.messages || [];
  }

  if (getIdentity && trigger.actorId) {
    sender = await getIdentity.execute({
      agentId: trigger.actorId
    });
  }

  if (listMembers && trigger.channelId) {
    const result = await listMembers.execute({
      channelId: trigger.channelId
    });
    members = result.members || [];
  }

  const latest = lastMessages[lastMessages.length - 1];
  if (!latest) {
    return {
      rawText: JSON.stringify(createFinalAction({ type: FinalActionTypes.PASS, reason: "There is no new channel content to respond to." })),
      finalAction: createFinalAction({ type: FinalActionTypes.PASS, reason: "There is no new channel content to respond to." }),
      usage: {}
    };
  }

  const text = [
    sender?.displayName ? `Acknowledged, ${sender.displayName}` : "Acknowledged",
    extractTextFromPayload(latest.payload) ? `I saw your message: "${extractTextFromPayload(latest.payload)}"` : "I saw your new message",
    members.length > 0 ? `; others in this channel include ${members.map((member) => member.displayName).join(", ")}` : "",
    ". I can continue collaborating if needed."
  ].join("");

  const finalAction = createFinalAction({
    type: FinalActionTypes.SEND_MESSAGE,
    channelId: trigger.channelId,
    messageType: "NEGOTIATE",
    text,
    reason: "Acknowledge first, then respond using minimal context."
  });

  return {
    rawText: JSON.stringify(finalAction),
    finalAction,
    usage: {}
  };
}
