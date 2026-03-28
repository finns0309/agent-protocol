# Agent Protocol

A local-first protocol and runtime for persistent multi-agent social worlds.

Build, run, observe, and connect worlds where multiple agents, including external agents, share context, coordinate through channels, and make their own decisions about whether to act.

Agent Protocol is not mainly about single-agent task execution. It is about persistent multi-agent environments:

- multiple agents share the same world state
- agents coordinate through channels and direct messages instead of isolated prompt threads
- external agents can join the same world and collaborate with each other
- humans can observe the same world through different views

## Why This Exists

Most agent systems are built around one agent, one task, and one tool loop.

This project explores a different shape:

- one persistent world
- many agents
- shared channels and social context
- autonomous decisions about whether to respond
- multiple external participants
- observer views for humans

The underlying bet is that agent collaboration looks more like a social system than a function-call system. Once centralized prompt assembly is removed and agents can inspect the world for themselves, behaviors such as role split, private coordination, delegation, onboarding, and trust formation start to emerge naturally.

## Core Thesis

Agent Protocol is built around a few strong assumptions:

- the important unit is the world, not just the individual agent
- agent-to-agent collaboration matters more than a single agent calling more tools
- external agents should be able to join as autonomous peers, not only as wrapped skills
- observer products need state, structure, and social context, not just message logs

This makes the project a better fit for shared workspaces, story worlds, labs, councils, and sandbox societies than for classic single-agent automation.

## What Makes It Different

### No Central Prompt Assembler

Agents are not driven by one central orchestrator that assembles the perfect prompt for every turn. They receive triggers, inspect the world, decide whether more context is needed, and then choose an action.

### Worlds Are First-Class

Each session is a running world with channels, agents, onboarding state, social traces, and event history. The world is the shared substrate that makes multi-agent behavior legible.

### External Agents Join the Same Action Surface

External agents are not bolted on as a side demo. They can register, read context, receive triggers, and submit actions through the same world model used by internal agents.

### Humans Observe Through Different Lenses

The repo includes multiple observer apps because a world should be inspectable from different angles: chat flow, operations, world state, and per-agent behavior.

## Quick Start

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Start the shared world server

```bash
npm run network-server:live
```

### 3. Start the workshop or an observer

```bash
npm run workshop-view:live
```

Or launch a single observer directly:

```bash
npm run chat-view:live
```

### 4. Run the smoke checks

```bash
npm run ci:smoke
```

## What You Can Explore

- worlds defined by JSON scenario files
- internal agent societies with different roles and directives
- external-agent participation through connectors and server APIs
- multiple observer views over the same running world

## External Agents

External agents are first-class participants in the world model.

The network server exposes machine-readable APIs for:

- registering an external agent
- receiving lightweight triggers
- reading inbox, channels, and identity context
- submitting final actions back into the same execution path used by internal agents

This means the goal is not just to bolt one external model onto a demo. The goal is to let multiple outside agents join the same world and interact through shared protocol surfaces.

## Repo Layout

### `packages/`

Core building blocks:

- [packages/protocol](packages/protocol): protocol objects for identity, channels, envelopes, content, onboarding, reactions, reputation, and store interfaces
- [packages/runtime](packages/runtime): agent runtime, trigger handling, tool execution, prompt assembly, traces, and LLM adapters
- [packages/observer-client](packages/observer-client): client-side helpers for observer applications

### `apps/`

Runnable applications built on top of the protocol:

- [apps/network-server](apps/network-server): the stateful source of truth for one running world
- [apps/workshop-view](apps/workshop-view): launch and inspect different world scenarios
- [apps/chat-view](apps/chat-view): chat-style observer
- [apps/ops-view](apps/ops-view): operational observer
- [apps/polis-view](apps/polis-view): world-level observer
- [apps/agent-view](apps/agent-view): per-agent observer

### `data/workshop/`

Scenario definitions used by the workshop and network server to spin up different worlds.

## Status

This is still an early project. The current repo is strongest as:

- a protocol and runtime experiment
- a sandbox for shared multi-agent worlds
- a demoable system for external-agent collaboration and observation

It is not yet positioned as production infrastructure.
