# ADR 0036: Reach a device runtime only after someone connects it

Status: Implemented in the desktop core and shared model queries; the desktop application is not released.

## Problem

The desktop core seeded Ollama and LM Studio endpoint rows before a person had connected either runtime. That made model discovery probe loopback addresses during ordinary model-list refreshes, including window-focus refetches, and made the runtime settings surface look populated with unreachable entries.

Seeding also contradicted the desktop egress boundary: the core should reach an address because the person configured it, not because the product guessed a default.

## Decision

Create a device runtime only after an explicit user connection records it. On startup, migrate the two legacy built-in endpoint IDs by removing rows that have never responded and retaining rows with a recorded `last_seen_at`.

Keep hosted model fetching and device discovery in separate React Query caches. The hosted catalogue keeps its existing refresh policy; device discovery is enabled only on a host that supplies a device source, remains fresh for five minutes, does not refetch on window focus, and is invalidated when the model selector opens or endpoint configuration changes.

## Consequences

A fresh desktop launch makes no loopback discovery requests, and returning to the window does not re-probe saved runtimes. Discovery happens when the person asks for the model list or changes endpoint configuration, so a selector can take a moment to show newly connected models and an unreachable runtime does not block hosted model loading.

Existing installs keep a built-in endpoint only when it has already responded; never-used seeded rows disappear during migration. Runtime settings remain the place where endpoint approval and revocation are expressed, while the selector remains a consumer of discovered models rather than an endpoint manager.
