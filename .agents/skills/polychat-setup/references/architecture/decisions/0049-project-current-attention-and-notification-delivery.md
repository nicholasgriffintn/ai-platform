# 0049: Derive attention from current task state and revalidate notification delivery

## Problem

A durable task may change after an inbox item or push delivery is created. Treating the notification as authority could expose task detail after membership removal, reopen a resolved decision, or let a read or dismissal alter shared execution state. Push destinations are also credentials whose ownership and replacement must survive multiple devices and sign-out.

## Decision

Derive attention from the task's current status, recipient relationship and monotonically increasing attention version. Store read and dismissal receipts separately per user, task and version. Pending decisions and meaningful failures apply to current workspace members, assignments to the current assignee, and completions for 30 days to the creator or assignee while they remain members.

Own each push registration by user, platform and installation. Replace its endpoint in place, prevent the same endpoint fingerprint from belonging to another account, and authenticated-encrypt the destination with the existing private data key. Keep operating-system permission on the client because permission does not prove backend registration.

Create a deduplicated delivery outbox entry for each eligible registration and task version. Immediately before delivery, revalidate current membership, attention state, recipient eligibility, preference and registration. Send its stable delivery identity as the provider idempotency key, plus only generic copy, an inbox item identifier and a server-resolved task path. Resolve every clicked link against current access and version; stale notifications do nothing.

Use a deployment-owned HTTPS gateway for platform delivery. Polychat sends the gateway protocol, platform, encrypted-at-rest destination and generic notification envelope; the gateway owns Web Push and APNs credentials and transport. Live Activities are outside this boundary.

## Status

Implemented.

## Consequences

Inbox reads, dismissals and old provider messages cannot change a task or bypass current Work authority. Registration replacement and sign-out are recoverable per installation, at the cost of an outbox, encryption key and provider gateway that operators must configure and monitor. Local contract validation cannot prove external APNs or browser delivery without those credentials and real devices.
