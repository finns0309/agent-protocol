# MiniMax Integration Notes

This project now supports a real-model entry point for internal protocol agents without changing the protocol runtime itself.

## What Is Wired

- `src/agents/model-adapter.js`
  - `OpenAICompatibleChatAdapter`
  - `MiniMaxModelAdapter`
  - `createMiniMaxAdapter()`
- `src/core/runtime.js`
  - new `stepAsync()` loop for model-backed agents
- `src/agents/factory.js`
  - `createRuntimeAgent()` helper
- `src/worlds/starship.js`
  - `createStarshipRuntimeAgents()` for internal LLM-driven crew
- `src/demo.js`
  - `starship-runtime` scenario

## Required Environment Variables

When you are ready to use MiniMax for real, provide:

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
  - default: `https://api.minimaxi.com/v1`
- `MINIMAX_MODEL`
  - default: `MiniMax-M2.5`

## Runtime Flow

The execution chain is now:

1. `ProtocolRuntime.stepAsync()`
2. `buildObservation()`
3. `AgentRuntime.decide()`
4. `PromptBuilder.build()`
5. `MiniMaxModelAdapter.generate()`
6. `OutputParser.parse()`
7. collapse the returned `plan` into the first executable action
8. world resolution and event persistence

The current worlds still resolve a single action per tick. The agent runtime already returns an action plan, but the protocol runtime collapses the plan to the first action for compatibility with the current world implementations.

## Current Limitation

This is intentionally a narrow first pass:

- no retry logic
- no rate-limit handling
- no streaming
- no multi-action execution in the world runtime yet
- no secret management beyond env vars
- no provider failover

That is fine for the first live integration pass. The point is to verify that model-backed agents can join the existing runtime and produce valid protocol actions.

## Demo Command

Without a MiniMax key:

```bash
npm run demo:starship:runtime
```

This uses the stub adapter and validates the async runtime path.

With a MiniMax key:

```bash
MINIMAX_API_KEY=... MINIMAX_BASE_URL=... MINIMAX_MODEL=... npm run demo:starship:runtime
```

## Why This Shape

The protocol runtime remains provider-agnostic.
Only the agent-runtime layer knows how to:

- turn observations into prompts
- call a model
- parse model output into protocol actions

That keeps the protocol aligned with the original goal: agent society semantics first, model/provider details second.

## Current MiniMax Note

The live integration currently uses the Anthropic-compatible MiniMax endpoint because it matches the desired calling pattern for internal agents.

In testing, this endpoint may emit long `thinking` blocks before the final JSON response. For that reason the default `maxTokens` budget was raised to `1200` so the model has enough room to produce both reasoning and the final action payload.
