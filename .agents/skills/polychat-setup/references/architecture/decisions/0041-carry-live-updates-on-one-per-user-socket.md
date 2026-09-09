# 0041: Carry live updates on one per-user socket

Status: accepted

## Problem

Every live surface polled on its own timer. Delegations refetched every two seconds in the background, the open conversation every two, project tasks and workbench runs on their own schedules, machines every minute. The chat sidebar had no timer at all, so a conversation started on one device took up to two minutes, or a window focus, to appear on another. Each surface invented its own freshness rule, the cost grew with every new one, and cross-device continuity was only ever as good as the slowest poll.

Durable Objects already held the pieces. `SandboxRunCoordinator` kept an ordered event log with a cursor, broadcast it over hibernating sockets and metered its own requests, but only for one sandbox run and only to server-side readers. No client anywhere opened a socket to our API; `WS_API_URL` existed solely to build a Content Security Policy.

## Decision

One WebSocket per device connects to a `UserSyncCoordinator` keyed by user id. It carries every live update in one envelope shape — topic, monotonic per-topic sequence, event type and payload — over topics named `user`, `conversation`, `project`, `workspace`, `run` and `machine`. `TopicEventBus` holds each topic's log in Durable Object SQL; a client reconnects with its last sequence per topic and receives the gap or a reset telling it to refetch. Features publish through `publishSyncEvent` and never touch sockets. Clients bind event types to query-cache effects in one table.

Authorisation happens once, at publish time. `publishSyncEvent` resolves an event's audience from current server-side ownership and workspace membership, then posts only to those users' coordinators. Because a coordinator is keyed by user id, it can only ever hold events already addressed to that user, so subscribing needs no second check — a topic you cannot read simply yields nothing. An earlier subscribe-time database check was removed: it duplicated this guarantee, cost a query per subscribe, and refused legitimate topics.

The socket is reached through a sixty-second signed grant carrying the user id, and that grant is the only authentication the upgrade needs. Session middleware cannot serve here: a browser `WebSocket` cannot send an `Authorization` header, so bearer-token clients could never connect through it.

Polling remains, wrapped in `liveOrPoll`, which takes the event type a surface depends on and stands the timer down only when that type is one the server actually publishes. A surface with a binding but no publisher keeps its own interval, so adding the client half of a live surface without the server half cannot silently make it stale.

## Consequences

A new live surface costs one publish call and one binding row, and inherits ordering, replay and reconnection without designing them again. The cost of liveness stops scaling with the number of polling surfaces.

Fan-out cost lands on Durable Object requests rather than Worker invocations, metered into `infra_cost_daily`. Publishing is deferred through the request's `waitUntil` so it never sits on the write path, every event for one recipient travels as a single batch, and audiences are cached for fifteen seconds — long enough to absorb a run's burst, short enough that a membership change takes effect quickly. An empty audience is never cached, because a conversation often publishes before its row is committed.

The coordinator sends to sockets the moment it appends. It must not batch behind a timer: hibernatable WebSockets let the object sleep between events, and anything held in memory rather than storage is lost when it does. Coalescing belongs on the client, where a four-hundred-millisecond window collapses a burst of events into one refetch per query.

Access is decided per publish, not continuously. Someone removed from a workspace stops being in the audience on the next event, but events already delivered to their coordinator remain replayable to them until retention drops them. Token-level streaming is not on this channel: the chat SSE response still belongs to the request that asked for it, and followers see a run at message granularity.

Machines are woken rather than polled. The desktop claim loop waits on its own `machine:` topic with a thirty-second fallback instead of asking every two seconds, and the API publishes when a run is queued.
