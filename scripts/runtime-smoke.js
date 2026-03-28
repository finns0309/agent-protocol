import {
  ChannelDirectory,
  ChannelModes,
  MemoryStore,
  MessageTypes,
  createChannel,
  createEnvelope,
  createIdentity
} from "../packages/protocol/src/index.js";
import {
  Agent,
  AgentMemory,
  createMiniMaxToolUseAdapter,
  MockToolUsingAdapter,
  ToolRegistry,
  TriggerTypes
} from "../packages/runtime/src/index.js";

const store = new MemoryStore();
const channels = new ChannelDirectory(store);

const alice = createIdentity({
  id: "alice",
  displayName: "Alice",
  role: "newcomer",
  directive: "introduce myself clearly",
  origin: "external"
});

const bob = createIdentity({
  id: "bob",
  displayName: "Bob",
  role: "host",
  directive: "help newcomers orient quickly",
  origin: "internal"
});

store.upsertIdentity(alice);
store.upsertIdentity(bob);

channels.create(
  createChannel({
    id: "general",
    mode: ChannelModes.GROUP,
    name: "General",
    members: ["alice", "bob"]
  })
);

store.appendEnvelope(
  createEnvelope({
    id: "env-1",
    from: "alice",
    channelId: "general",
    type: MessageTypes.ANNOUNCE,
    subject: "Capability intro",
    payload: {
      text: "Hi everyone. I am strong in Python, research synthesis, and rapid prototyping. Glad to join."
    }
  })
);

const tools = new ToolRegistry()
  .register({
    name: "read_channel",
    description: "Read the most recent messages from a channel.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string" },
        limit: { type: "number" }
      }
    },
    handler: async ({ input }) => ({
      messages: store.listEnvelopes({ channelId: input.channelId }).slice(-(input.limit || 10))
    })
  })
  .register({
    name: "list_members",
    description: "List the members in a channel.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string" }
      }
    },
    handler: async ({ input }) => {
      const channel = store.getChannel(input.channelId);
      return {
        members: (channel?.members || []).map((memberId) => store.getIdentity(memberId))
      };
    }
  })
  .register({
    name: "get_identity",
    description: "Read the identity information for an agent.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string" }
      }
    },
    handler: async ({ input }) => store.getIdentity(input.agentId)
  });

const bobAgent = new Agent({
  identity: bob,
  personaPrompt: "You are a careful but friendly long-time member. When a newcomer speaks, inspect the context before replying.",
  memory: new AgentMemory({
    summary: "You are responsible for welcoming newcomers and helping them find a collaboration entry point quickly."
  }),
  llm: process.env.MINIMAX_API_KEY ? createMiniMaxToolUseAdapter() : new MockToolUsingAdapter(),
  tools
});

const result = await bobAgent.handleTrigger({
  id: "trg-1",
  type: TriggerTypes.NEW_MESSAGE,
  actorId: "alice",
  channelId: "general",
  messageId: "env-1",
  summary: "A new message from Alice appeared in #general"
});

if (result.action.type === "send_message") {
  store.appendEnvelope(
    createEnvelope({
      id: "env-2",
      from: "bob",
      channelId: result.action.channelId,
      type: result.action.messageType || MessageTypes.NEGOTIATE,
      payload: {
        text: result.action.text
      }
    })
  );
}

console.log(
  JSON.stringify(
    {
      provider: process.env.MINIMAX_API_KEY ? "minimax" : "mock",
      prompt: result.trace.prompt,
      modelResult: result.trace.modelResult,
      finalAction: result.action,
      toolCalls: result.trace.toolCalls,
      messagesAfter: store.listEnvelopes({ channelId: "general" }).map((message) => ({
        from: message.from,
        type: message.type,
        text: message.payload.text
      }))
    },
    null,
    2
  )
);
