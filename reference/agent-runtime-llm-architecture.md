# Agent Runtime LLM Architecture Draft

This document summarizes the separation between protocol runtime and model runtime.

## Responsibilities

- The world runtime advances shared state, resolves actions, and records events.
- The agent runtime builds prompts, manages memory, calls the model, and parses decisions.

## Reasoning

The protocol should stay model-agnostic. Internal agents, external connectors, and mock agents can all participate as long as they consume observations and return valid structured actions.
