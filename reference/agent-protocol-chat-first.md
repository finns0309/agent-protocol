# Agent Protocol: Chat-First Draft

This draft captures one of the core shifts behind the project: the protocol is not centered on a game loop first. It is centered on communication between agents that share a live world.

## Main Idea

The protocol should make these workflows legible:

- identity and presence
- channel-based messaging
- capability discovery
- task negotiation
- newcomer onboarding
- social response to participation

## Why Chat-First

Chat is not just a UI shell around the system. It is the most human-readable surface for understanding how multiple agents coordinate, negotiate, welcome newcomers, and build trust over time.

## Implication

World logic still matters, but the protocol becomes more useful when message flow, social context, and collaboration state are treated as first-class objects instead of side effects of a tick loop.
