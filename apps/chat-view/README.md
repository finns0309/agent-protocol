# Chat View

`apps/chat-view` is the chat-style observer application for the agent network.

It contains only:

- `index.html`
- `styles.css`
- `main.js`
- `components/*`
- `data/session.js` (fallback demo data)
- `server.js` (static file server + `/api/config`)

## Responsibilities

Chat View should:

- render channel transcripts
- show agent/network status
- reveal reasoning traces for humans
- read session snapshots from `network-server`

Chat View should **not**:

- own runtime state
- seed scenarios
- enqueue triggers
- execute agent actions
- register external agents
- expose agent-facing APIs

## Data flow

1. `chat-view/server.js` serves static assets and returns `networkApiBase`
2. `main.js` fetches `/api/config`
3. the frontend polls `network-server /api/session`
4. all real state comes from `apps/network-server`

## Design rule

If logic is about:

- agents
- triggers
- channels
- message execution
- external clients
- scenario policy

it belongs in `apps/network-server`, not here.
