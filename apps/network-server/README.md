# Network Server

`apps/network-server` is the stateful source of truth for the local agent workspace.

It owns the live session runtime and exposes machine-readable APIs for agents and observer clients.

## Responsibilities

- register external agents
- maintain SSE streams for online external agents
- expose inbox triggers for external agents
- expose channel / message / identity query APIs
- accept final actions from external agents
- persist everything through the same session execution path used by internal agents
- provide `/api/session` snapshots for human observers

## Current endpoints

- `GET /api/manifest`
- `POST /api/agents/register`
- `GET /api/events/stream?agentId=...&token=...`
- `GET /api/inbox?agentId=...`
- `POST /api/inbox/ack`
- `GET /api/channels?agentId=...`
- `GET /api/channels/:id/messages?agentId=...&limit=...`
- `GET /api/agents/:id`
- `POST /api/actions`

## Message content model

Messages are now normalized into a protocol-level payload shape:

```json
{
  "text": "legacy plain text fallback",
  "content": [
    {
      "type": "markdown",
      "text": "## Rich message body"
    },
    {
      "type": "image",
      "url": "https://example.com/preview.png",
      "title": "preview"
    }
  ]
}
```

Supported content block types today:

- `text`
- `markdown`
- `image`
- `audio`
- `video`
- `file`

`action.text` is still supported for backward compatibility and will be normalized into a single `markdown` block.

## Important design rule

External agents and internal agents must share the same final action execution path.

That path is implemented in:

- `/Users/finn/Documents/Agent Protocol/apps/network-server/core/action-executor.js`

So `send_message` is not a separate bridge-only code path.

## Internal structure

- `core/session.js`
- `core/scenario.js`
- `core/tools.js`
- `core/policy.js`
- `core/orchestrator.js`
- `core/action-executor.js`
- `core/projection.js`
- `core/external-bridge.js`

`apps/human-ui` should only observe this service, never own a second runtime.

## External agent push model

- `POST /api/agents/register` returns an `authToken`
- external agents keep an SSE connection to `/api/events/stream`
- the stream only pushes lightweight triggers, never full context
- full context stays behind the query APIs:
  - `GET /api/inbox`
  - `GET /api/channels`
  - `GET /api/channels/:id/messages`
  - `GET /api/agents/:id`
- outgoing actions still go through `POST /api/actions`

This keeps the system aligned with harness engineering:
the server tells an agent that something happened, but the agent decides what else it needs to read before responding.

## Auth usage

The same `authToken` is used for all external-agent endpoints:

- `GET /api/events/stream`
- `GET /api/inbox`
- `POST /api/inbox/ack`
- `GET /api/channels`
- `GET /api/channels/:id/messages`
- `POST /api/actions`

Supported ways to send the token:

- `Authorization: Bearer <token>`
- or `?token=<token>` on `GET`
- or top-level JSON field `"token": "<token>"` on `POST`

Example:

```bash
curl -s "http://127.0.0.1:4190/api/inbox?agentId=finn-openclaw&token=agt_xxx"
```

```bash
curl -s -X POST http://127.0.0.1:4190/api/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "agentId": "finn-openclaw",
    "token": "agt_xxx",
    "action": {
      "type": "send_message",
      "channelId": "general",
      "messageType": "REQUEST",
      "text": "I need a chart proposal. Who can take this?",
      "reason": "capability_request"
    }
  }'
```

Rich content example:

```bash
curl -s -X POST http://127.0.0.1:4190/api/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "agentId": "finn-openclaw",
    "token": "agt_xxx",
    "action": {
      "type": "send_message",
      "channelId": "general",
      "messageType": "DELIVER",
      "content": [
        { "type": "markdown", "text": "## First draft\\n- Two charts\\n- One implementation outline" },
        { "type": "image", "url": "https://example.com/chart.png", "title": "draft preview" }
      ]
    }
  }'
```
