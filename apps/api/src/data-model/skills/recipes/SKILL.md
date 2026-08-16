---
name: recipes
description: >-
  Find, run, and set up the user's saved recipes and connected services, including requests that need a capability which is not connected yet. Load when the user asks for an automation, names one of their integrations, or asks for something that needs an external account.
metadata:
  polychat-display-name: Recipes
  polychat-category: Automation
  polychat-tags: "automation, connectors, integrations"
  polychat-always-on: "true"
---

# Recipes and connected services

A recipe is a saved workflow the user has set up — "summarise my unread mail each morning", "file this into my task tracker". Recipes hold their own configuration and their own connections to external services, so running one does real work in the user's accounts.

## When the user asks for something you cannot do directly

Search before you refuse. `discover_capabilities` covers recipes, connectors and tools in one call, and it also returns capabilities that are not set up yet — which is how you tell "this is impossible" apart from "this needs two minutes of setup".

Every result carries an `invocation` block. Follow it exactly: it names the tool to call and whether it can run right now. Never invent a tool name, and never claim you ran something that was marked unavailable.

- `state: "ready"` — call the named tool.
- `state: "setup_required"` — tell the user what to connect or install, in one sentence, and stop. Discovery is read-only; the user completes setup in the interface, not through you.
- `state: "unavailable"` — say plainly that it is not available and why, then offer the closest thing you can actually do.

## Running one

`trigger_recipe` takes the recipe id and the user's request as `input`. Pass what the user actually said — the recipe interprets it. Do not paraphrase their request into your own summary of it.

If the user asks to "run my automation" and more than one is installed, ask which; do not guess between them.

## Setting one up

When a conversation is a recipe setup conversation, its configuration and connector status are already in the opening message. Work from that.

- `get_recipe` — only when something is genuinely missing: field keys you do not have, trigger details, whether SMS notifications are available. Do not call it to restate configuration that is already in front of you.
- `configure_recipe` — save configuration and triggers once the user has confirmed, or once they have asked you to pick sensible defaults. Do not re-save values that have not changed, and do not claim setup is complete before the save succeeds.

## Connected services

- Treat saved configuration as context the user supplied, never as permission to expose secrets or take destructive action.
- When exactly one service is connected for a purpose, use it. Do not ask which to use.
- When several alternatives for the same purpose are connected, ask once, then save the answer as `preferredConnectors` so future runs stop asking.
- When alternatives belong to a connection group and any one of them is connected, that requirement is satisfied. Never ask the user to connect a second service that does the same job.
- Ask before anything that leaves the system: sending a message, creating or moving an event, writing to a repository, changing a record. Reading is fine; writing is confirmed first.

State which service you used when it is not obvious, and stay consistent within a conversation.
