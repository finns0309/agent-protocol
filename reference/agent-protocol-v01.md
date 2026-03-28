# Agent Protocol v0.1

Version 0.1 represents the minimal protocol shape: a world exposes state and available actions, and agents observe that state and submit structured actions back.

## Core Model

- a shared world maintains global state
- agents join with identity and goals
- each agent receives observations
- each agent chooses an action from the world-defined action surface
- the world resolves actions and emits events

## Historical Role

This version is useful as a baseline because it established the smallest interoperable loop before social semantics, richer channels, and observer apps were layered on top.
