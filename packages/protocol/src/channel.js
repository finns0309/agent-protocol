import { assertArray, assertObject, assertOneOf, assertOptionalObject, assertString, clone } from "./utils.js";

export const ChannelModes = {
  BROADCAST: "broadcast",
  GROUP: "group",
  DIRECT: "direct"
};

const CHANNEL_MODE_VALUES = new Set(Object.values(ChannelModes));

export function createChannel(spec) {
  assertObject(spec, "channel");
  assertString(spec.id, "channel.id");
  assertString(spec.mode, "channel.mode");
  assertOneOf(spec.mode, CHANNEL_MODE_VALUES, "channel.mode");
  assertString(spec.name, "channel.name");
  assertArray(spec.members || [], "channel.members");
  assertOptionalObject(spec.metadata, "channel.metadata");

  return clone({
    id: spec.id,
    mode: spec.mode,
    name: spec.name,
    members: spec.members || [],
    metadata: spec.metadata || {}
  });
}

export class ChannelDirectory {
  constructor(store) {
    this.store = store;
  }

  create(channelSpec) {
    const channel = createChannel(channelSpec);
    this.store.upsertChannel(channel);
    return channel;
  }

  get(channelId) {
    return this.store.getChannel(channelId);
  }

  list() {
    return this.store.listChannels();
  }

  addMember(channelId, agentId) {
    const channel = this.get(channelId);
    if (!channel) {
      throw new Error(`Unknown channel: ${channelId}`);
    }

    if (!channel.members.includes(agentId)) {
      channel.members.push(agentId);
      this.store.upsertChannel(channel);
    }

    return channel;
  }

  resolveRecipients(channelId) {
    const channel = this.get(channelId);
    return channel ? clone(channel.members) : [];
  }
}
