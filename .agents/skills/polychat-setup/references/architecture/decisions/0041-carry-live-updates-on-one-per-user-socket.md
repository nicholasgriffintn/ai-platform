# 0041: Carry live updates on one per-user socket

Status: accepted

## Problem

Every live surface polled on its own timer. Delegations refetched every two seconds in the background, the open conversation every two, project tasks and workbench runs on their own schedules, machines every minute. The chat sidebar had no timer at all, so a conversation started on one device took up to two minutes, or a window focus, to appear on another. Each surface invented its own freshness rule, the cost grew with every new one, and cross-device continuity was only ever as good as the slowest poll.

Durable Objects already held the pieces. `SandboxRunCoordinator` kept an ordered event log with a cursor, broadcast it over hibernating sockets and metered its own requests, but only for one sandbox run and only to server-side readers. No client anywhere opened a socket to our API; `WS_API_URL` existed solely to build a Content Security Policy.

## Decision

One WebSocket per device connects to a `UserSyncCoordinator` keyed by user id. It carries every live update in one envelope shape — topic, monotonic per-topic sequence, event type and payload — over topics named `user`, `conversation`, `project`, `workspace`, `run` and `machine`. `TopicEventBus` holds each topic's log in Durable Object SQL; a client reconnects with its last sequence per topic and receives the gap or a reset telling it to refetch. Features publish through `publishSyncEvent` and never touch sockets. Clients bind event types to query-cache effects in one table.

Subscription is authorisation. The coordinator checks the connecting user's current access to each topic before attaching it — conversation ownership for personal scope, live workspace membership for project scope — and audiences are resolved server-side at publish time rather than claimed by the client. The socket is reached through a sixty-second signed grant so bearer-token clients that cannot set WebSocket headers authenticate the same way browsers do.

Polling remains, wrapped in `liveOrPoll`. When the socket is open every interval returns `false`; when it is not, each surface falls back to the interval it had before.

## Consequences

A new live surface costs one publish call and one binding row, and inherits ordering, replay and reconnection without designing them again. The cost of liveness stops scaling with the number of polling surfaces.

Fan-out cost now lands on Durable Object requests rather than Worker invocations, coalesced into a fifty-millisecond window per topic and metered into `infra_cost_daily`. A conversation's audience is recomputed on each publish, so a large workspace pays a membership query per event.

Access is re-checked when a topic is subscribed and when an event is published, not continuously. Someone removed from a workspace mid-subscription keeps receiving that topic until they reconnect. Token-level streaming is not on this channel: the chat SSE response still belongs to the request that asked for it, and followers see a run at message granularity.
