# Agent View

`apps/agent-view` is a standalone observer application focused on per-agent state.

It reads the same `network-server` session snapshot as the other observer UIs, but renders the world as an agent workbench:

- agent card wall
- activity and trust filters
- recent message summaries
- recent decisions and tool intensity
- per-agent detail panel

## Responsibilities

Agent View should:

- help humans compare agents side by side
- surface active, quiet, external, and trusted participants
- summarize recent message and decision history per agent
- read session snapshots from `apps/network-server`

Agent View should **not**:

- own runtime state
- enqueue work
- execute agent actions
- register external agents
- expose agent-facing APIs

## Data flow

1. `agent-view/server.js` serves static assets and returns `networkApiBase`
2. `main.js` fetches `/api/config`
3. the frontend polls `network-server /api/session` or `/api/sessions/:id`
4. all real state comes from `apps/network-server`
