import { ToolRegistry } from "../../../packages/runtime/src/index.js";
import {
  getAgentChannelSummary,
  getAgentSocialState,
  getChannelContext,
  getCollaborationSnapshot
} from "./social-queries.js";

export function createSessionToolRegistry(session) {
  return new ToolRegistry()
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
        messages: session.store.listEnvelopes({ channelId: input.channelId }).slice(-(input.limit || 10))
      })
    })
    .register({
      name: "list_members",
      description: "List the members of a channel.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string" }
        }
      },
      handler: async ({ input }) => {
        const channel = session.store.getChannel(input.channelId);
        return {
          members: (channel?.members || []).map((memberId) => session.store.getIdentity(memberId))
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
      handler: async ({ input }) => session.store.getIdentity(input.agentId)
    })
    .register({
      name: "list_channels",
      description: "List the channels currently accessible to you.",
      inputSchema: {
        type: "object",
        properties: {}
      },
      handler: async () => ({
        channels: session.store.listChannels()
      })
    })
    .register({
      name: "list_agent_channels",
      description: "List the channels where an agent is currently collaborating, useful for estimating workload and execution space.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" }
        }
      },
      handler: async ({ agentId, input }) => {
        const targetAgentId = input.agentId || agentId;
        return getAgentChannelSummary(session, targetAgentId);
      }
    })
    .register({
      name: "get_channel_context",
      description: "Read a channel's topic, visibility, member count, and recent activity summary.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string" },
          limit: { type: "number" }
        }
      },
      handler: async ({ input }) => {
        return getChannelContext(session, input.channelId, input.limit);
      }
    })
    .register({
      name: "get_collaboration_snapshot",
      description: "Inspect the shared channels, recent interactions, and collaboration traces between you and another agent.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          limit: { type: "number" }
        }
      },
      handler: async ({ agentId, input }) => {
        return getCollaborationSnapshot(session, agentId, input.agentId, input.limit);
      }
    })
    .register({
      name: "get_agent_social_state",
      description: "Inspect an agent's onboarding state, reputation events, and recent reactions.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          limit: { type: "number" }
        }
      },
      handler: async ({ input }) => {
        return getAgentSocialState(session, input.agentId, input.limit);
      }
    });
}
