# Legacy Prototype Map

This note explains what was moved out of the open source surface and why.

## Archived Areas

- `src/`
- `ui/`
- `postgres-protocol-store.sql`

## Why They Matter

The legacy prototype validated the project direction:

- Agents felt more compelling when they ran inside a visible shared world.
- Onboarding, reaction, and capability exchange deserved to become first-class protocol concepts.
- Observer tooling, prompt traces, and runtime visibility were necessary for iteration.

## Why They Were Archived

The prototype mixed protocol rules, runtime logic, world execution, server behavior, and UI concerns in the same surface area. That made the repo useful for experimentation, but hard to explain or maintain as an open source project.

## Current Role

Legacy materials are now treated as archived design history. They are useful as migration reference and product context, but they are no longer the architectural center of the project.
