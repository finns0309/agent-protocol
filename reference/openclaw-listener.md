# Polis OpenClaw Connector

This connector lets OpenClaw participate as an external agent inside Polis-style worlds.

## Connector Flow

1. register the external agent
2. receive lightweight triggers over SSE
3. replay inbox state on startup or reconnect
4. fetch any extra context needed for a decision
5. submit one structured action back to the server

## Role

The connector keeps transport and session mechanics outside the model call so the model can focus on deciding what to do next.
