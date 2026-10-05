# ADR 0071: Tools declare what they change

Status: Implemented for built-in API tools. MCP and Composio operations are classified at their execution boundary in a later change.

## Problem

Approval decisions read a tool's coarse permissions (`read`, `write`, `network` and so on) and its name. Neither says what a particular call does. `call_api` with GET and with DELETE carry the same permissions; generating an image into the person's own Files and filing a task that starts governed work both say `write`. A Poly that acts on someone's behalf needs to loosen approval for low-risk work without ever loosening it for sending, spending or deleting, and that rule cannot be written against names or prose. Comparable products that classified actions with regular expressions over free text later replaced them, because the text described intent rather than effect.

## Decision

Every tool may declare `effects`: an effect class, optionally computed from the call's input, and an optional destination such as an API origin or connector provider. The classes are `read`, `draft`, `write`, `external_send`, `spend`, `destructive`, `credential` and `data_export`, defined once in `packages/schemas`.

- `read` changes nothing that persists.
- `draft` creates or changes content inside Polychat that people can review, revise or remove, without starting work that acts on its own: notes, documents, generated media, memory, goals, delegations.
- `write` changes another system or sets up work that runs on its own: project tasks, schedules, recipe runs, repositories, connectors, computers, code that can call tools.
- The remaining five send to people, spend money, delete irreversibly, handle credentials or move data out. They are the effects that no standing approval may ever cover.

A tool without a declaration resolves to `write`, so an omission asks rather than runs. The API's built-in catalogue calls `requireToolEffects` when it is built and refuses an undeclared tool, the same way it already refuses a tool without permissions. `ai-agents` keeps effects optional, because its tools come from callers outside this catalogue.

The class describes the call, not the run scope, so the same tool keeps one class in personal and project conversations. Scope and membership remain the job of the existing access checks.

## Consequences

Approval and autonomy rules can now be expressed over effects, and receipts can say what kind of change happened. Classifying built-in tools is a review decision recorded beside each descriptor rather than inferred. Dynamic classes run model-supplied input through code, so they must stay pure and cheap. Connector operations already carry `readOnly`, `destructive` and `openWorld` flags; until those are read at execution time, connector execution is classified as `write` and discovery as `read`.
