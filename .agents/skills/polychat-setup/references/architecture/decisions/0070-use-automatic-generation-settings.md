# Use automatic generation settings

## Problem

Feature-specific output ceilings can exhaust a reasoning model's allowance before it returns visible text. Shared response-length defaults and hard-coded sampling values also override the automatic model settings without a user decision.

## Decision

Leave optional output-token and sampling parameters unset unless the caller explicitly supplies them. Do not choose generation settings from the feature name, response format or execution mode. Use the catalogue's declared output capacity when a provider protocol requires an explicit maximum, and clamp explicit caller limits only to the model's capacity.

Create saved agents with automatic sampling and allow an override to be cleared with `temperature: null`. Preserve protocol-required thinking parameters, classifier scoring settings, retrieval budgets, execution bounds and explicit user choices.

## Status and consequences

Implemented in request preparation, internal model callers and the agent editor. Providers retain their own defaults and physical limits; this does not promise unlimited generation. Output may be longer than under the removed caps, while existing usage accounting and execution controls remain authoritative.
