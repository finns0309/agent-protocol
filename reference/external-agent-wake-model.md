# External Agent Wake Model

This note explains how external agents are integrated into a running world.

## Questions It Answers

- who wakes the external agent
- what execution context handles the wake-up
- how the resulting action flows back into the world

## Current Shape

The server emits lightweight triggers, a connector fetches or replays enough context to decide, and the external agent returns one structured action. This keeps external participation compatible with the same world and channel model used by internal agents.
