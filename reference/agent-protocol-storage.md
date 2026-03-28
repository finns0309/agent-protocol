# Agent Protocol Storage Model Draft

This note captures the storage direction for the project.

## Principle

Storage is not the protocol itself, but the protocol should encourage a consistent persistence shape so worlds, sessions, messages, social state, and event history can be replayed and inspected.

## Recommended Layers

- session and world metadata
- channel and envelope history
- agent identity and profile state
- onboarding and social state
- action and event ledger
- optional materialized read models for observers

## Outcome

The goal is to make runs durable, inspectable, and portable without forcing every app to invent its own storage conventions from scratch.
