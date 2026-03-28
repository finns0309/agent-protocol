import {
  ChannelDirectory,
  ChannelModes,
  MemoryStore,
  MessageTypes,
  PresenceStates,
  ReactionTypes,
  ReputationLedger,
  TrustStates,
  addIntroduction,
  createCapabilityProfile,
  createChannel,
  createEnvelope,
  createIdentity,
  createOnboardingRecord,
  createReaction
} from "../packages/protocol/src/index.js";

const store = new MemoryStore();
const channels = new ChannelDirectory(store);
const reputation = new ReputationLedger(store);

const alice = createIdentity({
  id: "alice",
  displayName: "Alice",
  role: "agent",
  directive: "help the network",
  origin: "smoke-test"
});

const bob = createIdentity({
  id: "bob",
  displayName: "Bob",
  role: "agent",
  directive: "evaluate newcomers",
  origin: "smoke-test"
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

store.upsertOnboarding(
  addIntroduction(
    createOnboardingRecord({
      agentId: "alice",
      presenceState: PresenceStates.REQUESTED_JOIN,
      trustState: TrustStates.UNKNOWN,
      integrationOutcome: "pending"
    }),
    {
      by: "alice",
      summary: "I can write code and produce research summaries."
    }
  )
);

store.appendEnvelope(
  createEnvelope({
    id: "env-1",
    from: "alice",
    channelId: "general",
    type: MessageTypes.ANNOUNCE,
    subject: "Capability intro",
    payload: {
      capability: createCapabilityProfile({
        skills: ["research", "coding"],
        preferredTasks: ["summarize", "prototype"]
      })
    }
  })
);

store.appendReaction(
  createReaction({
    id: "react-1",
    actor: "bob",
    target: "alice",
    type: ReactionTypes.OFFER_TASK,
    summary: "Bob invited Alice to help summarize the protocol discussion.",
    channelId: "general"
  })
);

reputation.record({
  id: "rep-1",
  agentId: "alice",
  kind: "positive_delivery",
  delta: 5,
  summary: "Alice delivered a clear capability introduction."
});

console.log(
  JSON.stringify(
    {
      identities: store.listIdentities().map((identity) => identity.id),
      channels: store.listChannels().map((channel) => channel.id),
      envelopes: store.listEnvelopes().map((envelope) => envelope.type),
      onboarding: store.getOnboarding("alice"),
      reactions: store.listReactions({ target: "alice" }).map((reaction) => reaction.type),
      reputationScore: reputation.getScore("alice")
    },
    null,
    2
  )
);
