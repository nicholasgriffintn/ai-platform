# ADR 0096: Environments are where responses execute

Status: Accepted. The `environment` request field is implemented; the `/environments` resource is not yet.

## Problem

Where a run executed was spread across `compute_site`, `options.sandbox`, machine runs under `/machines/:id/runs`, hosted computers under `/computer-use/sessions` and again under `/teammates/contexts/:id/computer`, and the sandbox run lifecycle under `/apps/sandbox/runs`. Each had its own lifecycle, its own events and its own client code, although every one of them is the same question: in which place does this response run.

## Decision

A Response names its environment: `{ type: "hosted" }`, `{ type: "browser" }`, `{ type: "device" }`, `{ type: "machine", machine_id? }` or `{ type: "sandbox", ...options }`. The request field replaces `compute_site` and the sandbox request options on the public wire and maps onto the engine's existing fields.

Environments become a resource of their own in a following change: `/environments` with sandbox workspaces, hosted computers, machine environments and harness workspaces, with leases, previews and takeover as sub-resources, and the sandbox run lifecycle, computer-use sessions and teammate computer routes folded into it. The device protocol a desktop uses to claim and report a run stays under `/machines`, because it is a worker contract and not a user API; see [ADR 0034](0034-advertise-machines-through-a-control-plane-that-never-carries-content.md) and [ADR 0092](0092-host-agent-harnesses-on-polychat-ports.md).

## Consequences

Clients stop choosing routes by execution site. The remaining lifecycle routes are listed in the route-trimming plan that follows this change.
