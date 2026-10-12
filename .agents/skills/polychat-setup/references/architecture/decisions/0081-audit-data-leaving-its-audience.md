# ADR 0081: Audit data leaving its audience before enforcing it

Status: Implemented in audit mode. Enforcement is a later decision.

## Problem

Scope checks decide whether a run may act somewhere, not whether what it read may go there. Inside Polychat the boundaries already hold: the Poly's channel bindings are personal, delegations and project tasks inherit their parent's scope, and project conversations cannot be shared publicly. The open path is egress. A personal conversation carries memory, notes, documents and earlier conversations in its context, and a connector, MCP or HTTP write can carry any of it to Slack, GitHub or email. The approval rules (ADR 0071, 0073) ask about the kind of change, not about whose data travels with it, and Polychat does not yet know the readers of most external destinations.

## Decision

Model a flow as source audience to destination audience and decide it with a `data.flow` Cedar action: data may flow only to the same personal or project scope. An external destination is never the same audience.

- A tool call is egress when its declared effect (ADR 0071) is `write`, `external_send`, `data_export`, `destructive` or `spend` and it declares a destination, which connector, MCP gateway and HTTP tools do.
- The source audience is the conversation's scope: the person in a personal conversation, the project in a project conversation.
- After an egress call actually runs, a denied flow is recorded as a `data_flow_egress` metric and log entry with the tool, destination, effect class, source scope, whether memory was in context, and which private-store tools (memory, notes, documents, saved messages, conversation search) contributed results.
- Nothing is blocked. Calls that error or wait for approval are not recorded.

## Consequences

We can see how often private context leaves Polychat and through which providers before choosing an enforcement rule. The likely next step is to make egress from a context holding private reads ask for approval unless the destination is covered by an exact data grant. Labels follow the conversation scope, not individual facts, so every egress from a personal conversation counts, which overstates real leaks. Declaring readers for known destinations (a Slack channel's members, a repository's visibility) is what lets the rule tighten without asking about everything.
