# ADR 0086: Host agent runtimes beside the sandbox

Status: Implemented for Hermes in `apps/computer-worker` and the API chat providers; needs a deployed canary before release.

## Problem

ADR 0029 makes Polychat a surface onto self-hosted agent gateways such as Hermes, but only from the desktop, over loopback or a typed address. Someone without a home server cannot use Hermes with Polychat at all. ADR 0029 also left gateway usage attribution open, because a gateway running against Polychat models spends tokens outside a Polychat conversation.

Community templates such as hermesworkers host Hermes in a single shared Cloudflare container with provider keys written to disk and open internet. That puts the agent loop, the credentials and the network in the box the agent controls.

## Decision

Run Hermes as a server agent driver beside `polychat-sandbox`. Selecting Hermes in a conversation routes through `HostedHermesChatProvider`, which drives one `AgentHost` container per member in the computer worker. Each conversation maps to its own Hermes session, so Hermes keeps its memory, skills and history while Polychat keeps the transcript.

Keep every credential outside the container. The container starts with `enableInternet = false` and only reaches two places. Package registries are read-only through the ADR 0085 egress policy. `polychat.internal` is intercepted by a Worker handler that adds a member-owned API key named "Hosted Hermes" and calls `/chat/completions` with `store: false`, no Polychat tools and the member's default tier. Hermes chooses neither the model nor the effort. Its tool calls come back to it unexecuted, and the member's plan meters every token. Revoking the key under API keys cuts the host off.

Checkpoint `HERMES_HOME` to R2 after each finished run, excluding locks, pids, sockets, logs and caches, and restore it on a cold start. The Hermes API server key lives in Durable Object storage and the process environment, never on disk. Schedules stay in recipes (ADR 0019) and channels stay Polychat's, so Hermes cron and messaging platforms are not configured.

Hermes approvals have no Polychat surface yet. The provider declines each approval request once and tells the person what Hermes asked to do. The driver therefore offers only Auto, which hands review to the agent, and reports that it cannot answer approvals.

## Consequences

Paid members get a persistent Hermes without running anything themselves, and its spend is attributed through the normal metering path. Hermes cannot browse the open web or install from hosts outside the registry list, which removes its research tools until a per-member allowlist exists.

The Hermes run contract is pinned to v2026.9.24 and was driven live, both from source and from the built image, against an OpenAI-compatible stub. The intercepted model route, R2 checkpoints and HTTPS interception still need a deployed canary. Container time is not yet metered, so the host sleeps after fifteen minutes and is limited to paid plans. Answering approvals in Polychat and resetting a host from settings remain follow-ups.
