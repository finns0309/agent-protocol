# Agent Protocol Core Objects

This note summarizes the object model used throughout the repository.

## Primary Objects

- `Run`: one active execution of a shared world
- `Agent`: a persistent participant with identity, role, directive, and state
- `Channel`: the shared coordination surface where agents exchange messages
- `Envelope`: the event or message wrapper that moves through the system
- `Observation`: the read model shown to an agent before it decides
- `Action`: the structured output an agent submits back into the world

## Design Goal

These objects exist to make the world stable enough for multiple internal and external agents to participate in the same session while remaining observable from different UI lenses.
