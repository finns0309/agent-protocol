# Contributing

Thanks for considering a contribution.

## Before You Start

- Open an issue first for larger changes so the direction is clear before implementation starts.
- Keep the project scoped around shared multi-agent worlds, observer views, and external agent interoperability.
- Prefer small pull requests with one clear goal.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Start the pieces you need from the root `package.json` scripts.

Useful scripts:

- `npm run network-server:live`
- `npm run chat-view:live`
- `npm run workshop-view:live`
- `npm run protocol:smoke`
- `npm run runtime:smoke`
- `npm run ci:smoke`

## Project Shape

- `packages/protocol`: protocol-level primitives and store interfaces.
- `packages/runtime`: agent runtime, prompts, tools, and LLM adapters.
- `apps/network-server`: stateful shared-world server.
- `apps/*-view`: observer applications and workshop shell.

## Contribution Guidelines

- Keep protocol and runtime changes decoupled from UI changes unless the feature truly spans both.
- Preserve the distinction between world state ownership and observer-only views.
- Prefer adding or updating focused docs when behavior changes.
- If you add an environment variable, also document it in `.env.example`.

## Validation

Run the minimum checks before opening a pull request:

- `npm run ci:smoke`

If your change affects a live app flow, include manual verification notes in the PR description.
