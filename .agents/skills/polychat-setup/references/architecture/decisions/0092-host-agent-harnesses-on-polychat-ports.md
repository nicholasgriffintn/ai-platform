# ADR 0092: Host agent harnesses on Polychat ports

Status: Implemented in `apps/agent-worker`, `apps/sandbox-worker` and the API `agents` module.

## Problem

Every server agent was wired in by hand. Hosted Hermes had its own client, wire schema, key rotation and wake route. OpenAI Agents was a sandbox provider with its own event translator. Neither streamed: both chat providers set `supportsStreaming = false`, and the Hermes path read its run's event stream only for tool names and approvals, so replies arrived as one block at the end. Adding the Pi or OpenCode harnesses would have meant a third and fourth bespoke path, each with its own way of reaching models, tools and approvals.

## Decision

A harness owns its agent loop and transcript. Polychat owns the ports every harness uses: models, workspace tools, approvals and events.

- `apps/agent-worker` hosts one Durable Object class per harness: `PiAgent` and `OpenCodeAgent` use the agents package's harness capabilities, and `HermesAgent` uses its container harness with a Hermes image. They share `HarnessHost`, which keeps an append-only event log, gates tools and exposes one RPC surface (`AgentHarnessRpc` in `packages/schemas`). One instance serves one user's conversation.
- Models go through the API's `POST /agents/model/chat/completions`, an OpenAI-compatible stream authenticated with a short internal delegation token the agent worker signs per call. It uses the chat pipeline's model routing and access checks and records usage for the delegated user. The host tees each model stream into the event log, so text arrives as it is generated. OpenCode uses its own `openai-compatible` provider, which only calls the global `fetch`, so the agent worker routes requests for the internal model host through the same service binding fetch by session.
- Workspace tools (run a command, read, write, edit, list and search files) are defined once with zod and rendered as a Pi extension for Pi and a plugin for OpenCode, which loses its own file and shell tools. They run in a per-session `Workspace` in the sandbox worker, under ADR 0085's egress policy. Each call is gated by the permission mode before it runs, and an approval reaches the person as the existing `request_approval` interaction whose id carries the resume cursor.
- Hermes runs in its own container with internet off. Its model traffic is intercepted to the same port, and its tool activity comes from the container harness's event stream. Its memory survives through the harness's idle snapshots.
- OpenAI Agents and Bedrock Managed Agents stay remote: they speak the same agent sessions protocol, and the API streams one hosted session per turn into the same event shape.
- Chat sees every harness as the `agent-harness` provider. Text and reasoning stream as OpenAI chunks, and tool activity uses a dedicated stream event that becomes tool parts. Chat, Work, teammates and Poly delegations all select harness agents as ordinary models.

The sandbox worker owns the `Workspace` and `Computer` containers that harness tools and hosted computers run in, with egress routed through its outbound handler.

## Consequences

A new harness is one adapter that implements four methods; it gets models, tools, approvals, streaming and billing without new API code.

OpenCode is experimental and Pi is in beta, so adapters pin exact versions. Pi's alarms cap a model stream at fifteen minutes, which its capability record states. An approval that waits across a Durable Object eviction is lost with the in-memory promise; the harness retries the tool or reports it interrupted, and the person sees a fresh approval card. OpenAI Agents sessions are created per turn and run on the OpenAI key Polychat resolves for the account, outside the model port. Bedrock Managed Agents sessions run on a customer AgentCore Runtime: project chats use the workspace AWS connection, and personal chats use the Runtime and role in the person's settings with their Bedrock key. Neither falls back to platform credentials.
