# ADR 0064: Keep evidence append-only and make policy a pure function

Status: Implemented.

## Problem

Governance breaks down when a verdict cannot be reproduced: a rule changed, a scan was re-run, and nobody can say what the approver saw. Hand-maintained allowlists of model IDs also stop scaling at a few hundred entries, which the cloud catalogues already demonstrate.

## Decision

Checks write dated **evidence** rows and never update them. Policies are typed rules over known fields (licence, source, format, remote code, gating, parameter count, evidence status, route region), versioned by content hash with every revision kept. `evaluatePolicies(subject, policies)` in `library-model-registry` is pure and runs identically for enforcement, previews, dry runs and replays. Effects combine by severity (`allow < warn < review < block`). A project policy is appended to the workspace policy, so it can only narrow.

An approval covers the issues its approver saw, matched by scope and rule ID. New review-level issues, such as drift from a nightly replay, reopen a review automatically. A block is covered only by an exception, which always carries an expiry.

## Consequences

Dry runs show exactly which verdicts a rule edit would change before it is saved. The rule language is deliberately small: conditions that need new facts require a new evidence kind rather than free-form expressions.
