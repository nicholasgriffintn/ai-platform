# ADR 0028: Response-scoped capability activation

## Status

Accepted. Extended by [ADR 0029](0029-server-managed-tool-selection.md).

## Context

ADR 0015 let a model discover a native tool that was useful and permitted but absent from the current request. The result then told the model to ask the person to enable it. Unlike connector authentication or recipe configuration, selecting a native tool grants no credential or persistent authority, and the capability response offered no native-tool setup action. The otherwise successful discovery therefore became a dead end and required the person to repeat the request.

Sending every native tool schema on every request would avoid that dead end but increase prompt cost and worsen tool selection. Letting model-authored output mutate saved tool settings would conflate relevance with durable user intent.

## Decision

Let `discover_capabilities` mark an eligible native function tool for automatic activation. Eligibility is resolved server-side from its registered definition, current mode policy, account and plan, and the effective personal or project scope. Work discovery continues to exclude tools outside the project's effective capability set.

After the registered discovery tool returns, the shared agent loop parses its structured result and merges only exact, server-marked native tool names into the effective tool set for later steps of that response. It mirrors the resulting set into the tool execution context, does not persist it, and does not accept activation names from model-authored prose or arguments. Provider shaping and execution reapply the existing permission, approval, usage, and input-validation checks.

Keep connector authentication, recipe installation, capability configuration, plan upgrades, and unavailable deployment features explicit. Discovery may expose a write-capable native tool, but its execution still stops at the existing approval boundary when the active policy requires approval.

Personal tool selection controls which tools are loaded eagerly. Response-scoped activation may add a relevant permitted tool after discovery. In Work, project capability selection remains an authorisation boundary and cannot be widened by discovery.

## Trade-offs

Discovery consumes one agent step and may add several bounded matching schemas to the next provider turn. This is smaller than loading the full function catalogue up front and works for providers without native deferred tool search.

A personally deselected native tool can still be used when the model deliberately discovers it. People who need a hard boundary rely on mode policy, approval policy, account eligibility, and project capability curation rather than prompt-shaping switches.

The activation marker is carried in the shared discovery contract even though the web interface does not act on it. That keeps the decision visible in stored tool results while the API remains the only authority that changes the live response.
