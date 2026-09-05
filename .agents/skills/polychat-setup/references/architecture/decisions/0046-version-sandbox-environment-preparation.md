# ADR 0046: Version sandbox environment preparation

Status: Accepted and implemented.

Coding runs previously cloned a repository and entered the agent loop without an explicit, reviewable preparation contract. Repeated work therefore could not distinguish full setup from lightweight resume, prove which configuration ran or report setup failure separately from implementation failure.

## Decision

Attach an optional environment setup contract to the project coding environment. Use either configuration saved by Polychat or the fixed repository convention `.polychat/environment.json`; do not accept a model-selected or user-supplied path. Both sources use the same versioned shared schema for full setup commands, lightweight resume commands, runtime and package-manager requirements and a bounded setup timeout.

Snapshot Polychat-owned configuration into the run at enqueue. Read repository-owned configuration from the cloned `HEAD`, reject oversized, malformed or unsupported definitions, and identify it by its Git blob revision. Identify Polychat-owned definitions by a SHA-256 digest of their parsed value. Record the source, revision, effective preparation mode, requirements, duration, command count and terminal status in run Proof.

Execute setup commands sequentially because later commands may depend on earlier ones. Validate every command with the existing sandbox command policy before execution and apply the same trust-level approval rules used by agent commands. Use only fixed internal commands to inspect runtime and package-manager versions; never interpolate saved version strings or repository fields into a shell command. A requested resume falls back to full setup when no resume commands are defined.

Reject recognisable inline credentials at the shared contract boundary. Setup receives no project-stored secret values, and persisted command output is bounded and redacted. A configuration may reference a separately governed environment variable, but storing or mounting those credentials remains a distinct future authority decision.

## Consequence

Projects gain a reproducible preparation input and runs explain setup failure before agent work begins. Repository configuration remains untrusted code and may require an approval or fail under the selected command policy. Snapshot and cache work can reuse the same resume contract later without changing project configuration semantics or treating cached filesystem state as authority.
