# ADR 0073: Teammate autonomy is a dial over effects

Status: Implemented for Poly. Other teammate contexts keep no level until someone sets one.

## Problem

A teammate that acts for someone needs to do low-risk work without a prompt for every step, while never sending, spending or deleting without a yes. Permission modes (ADR 0039) govern providers that write files and run commands, and the coarse tool permissions say what kind of tool something is, not what a particular call does. Every comparable assistant we reviewed converged on a small dial over effect classes with a floor that never loosens; the ones that let background runs skip approval, or keyed "always allow" on a tool name, had to walk it back.

## Decision

A teammate context may carry an autonomy level, stored on the context and changed only by its owner through a user-authenticated route. Poly's context starts at `assistant`; other contexts have no level and keep today's rules.

- `observer` runs reads and drafts and refuses anything else.
- `assistant` runs reads and drafts and asks before a `write`.
- `partner` also runs writes within the context's grants.
- `external_send`, `spend`, `destructive`, `credential` and `data_export` ask at every level, whoever started the run.

Each call is classified from its arguments with the tool's declared effects (ADR 0071) before the permission check, falling back to `write` when the arguments do not parse or a classifier throws. Teammate admission copies the context's live level into the run, so tightening the dial applies to the next call of any run admitted after the change. The decision is three Cedar statements beside the existing tool policies: an observer forbid on `tool.use`, and a floor and an assistant forbid on `tool.unattended`. The dial is a ceiling over the existing rules, so mode approvals, denied tools and teammate kinds still apply; a partner cannot loosen what a mode already asks for.

Approvals reuse the existing pending-approval rail. A background run has no client to supply an approval, so anything that asks there waits for the person.

## Consequences

Poly can be trusted with more over time without a standing account-wide grant, which ADR 0039 rules out, and the floor makes the worst outcomes always visible. Tools without accurate effect declarations become the weak point, so built-in tools must declare them and MCP and connector operations fail closed to `write` until their own flags are read. Approving a tool by name still approves that call for the rest of the turn, so exact, expiring standing approvals per destination are a separate, later decision.
