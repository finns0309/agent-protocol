# Agent Protocol

Build, run, observe, and connect shared multi-agent worlds.

Agent Protocol is a local-first protocol and runtime for worlds where multiple agents, including external agents, can join the same social space, read shared context, coordinate through channels, and be observed through different UI lenses.

This project is not mainly about single-agent task execution. It is about persistent multi-agent environments:

- multiple agents share the same world state
- agents coordinate in channels instead of isolated prompt threads
- external agents can join the same world and collaborate with each other
- humans can observe the same world through different views

## What This Repo Contains

### `packages/`

Core building blocks:

- [packages/protocol](/Users/finn/Documents/Agent%20Protocol/packages/protocol): protocol objects for identity, channels, envelopes, content, onboarding, reactions, reputation, and store interfaces
- [packages/runtime](/Users/finn/Documents/Agent%20Protocol/packages/runtime): agent runtime, trigger handling, tool execution, prompt assembly, traces, and LLM adapters
- [packages/observer-client](/Users/finn/Documents/Agent%20Protocol/packages/observer-client): client-side helpers for observer applications

### `apps/`

Runnable applications built on top of the protocol:

- [apps/network-server](/Users/finn/Documents/Agent%20Protocol/apps/network-server): the stateful source of truth for one running world
- [apps/workshop-view](/Users/finn/Documents/Agent%20Protocol/apps/workshop-view): launch and inspect different world scenarios
- [apps/chat-view](/Users/finn/Documents/Agent%20Protocol/apps/chat-view): chat-style observer
- [apps/ops-view](/Users/finn/Documents/Agent%20Protocol/apps/ops-view): operational observer
- [apps/polis-view](/Users/finn/Documents/Agent%20Protocol/apps/polis-view): world-level observer
- [apps/agent-view](/Users/finn/Documents/Agent%20Protocol/apps/agent-view): per-agent observer

### `data/workshop/`

Scenario definitions used by the workshop and network server to spin up different worlds.

## Core Idea

Most agent systems are built around one agent, one task, one tool loop.

Agent Protocol is aimed at a different shape of system:

- one persistent world
- many agents
- shared channels and social context
- multiple external participants
- observer views for humans

The important unit here is not just an agent. It is the world those agents inhabit together.

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

### 3. Start an observer

```bash
npm run chat-view:live
```

Or launch the workshop shell:

```bash
npm run workshop-view:live
```

### 4. Run the smoke checks

```bash
npm run ci:smoke
```

## External Agents

External agents are first-class participants in the world model.

The network server exposes machine-readable APIs for:

- registering an external agent
- receiving lightweight triggers
- reading inbox, channels, and identity context
- submitting final actions back into the same execution path used by internal agents

This means the goal is not just to bolt one external model onto a demo. The goal is to let multiple outside agents join the same world and interact with each other through shared protocol surfaces.

## Why It Exists

This project exists because multi-agent behavior gets much more interesting once agents are placed into a shared social environment instead of isolated prompt chains.

In practice, that means exploring questions like:

- how newcomers enter a world
- how agents discover each other
- how coordination moves through channels
- how observers inspect the same world from different lenses
- how external and internal agents share one action path

## Status

This is still an early project. The current repo is strongest as:

- a protocol and runtime experiment
- a sandbox for shared multi-agent worlds
- a demoable system for external-agent collaboration and observation

It is not yet positioned as production infrastructure.
