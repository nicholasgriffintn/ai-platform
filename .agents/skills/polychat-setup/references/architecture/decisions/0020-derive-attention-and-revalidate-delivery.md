# ADR 0020: Derive attention from authoritative work state and revalidate every delivery

Status: Implemented.

## Problem

People with several workspaces need one operational view, but a copied attention table would become another workflow state machine and could retain work after membership or source state changed. Searching conversation prose would mistake descriptions for actionable state.

A durable task also changes after a notification is created. Treating the notification as authority could expose task detail after membership removal, reopen a resolved decision, or let a read or dismissal alter shared execution state. Push destinations are themselves credentials whose ownership and replacement must survive multiple devices and sign-out.

## Decision

Define **Attention** as an API read model over current project-task interaction state and sandbox-run Activity records. It has no identity or persistence of its own. Map task blocks awaiting approval or input, review, other blocked states, queued or running work and seven days of completed work into the shared approval, input, review, failed, running and completed meanings. Map sandbox activity through its durable status and persisted run status; a waiting state older than the maximum approval window becomes failed or stalled rather than remaining falsely actionable.

Validate state, workspace, project, owner, type, inclusive date, limit and offset filters at the route. Order by authoritative occurrence time descending and stable item identity descending, return an exact filtered total, and derive filter facets only from currently eligible candidates. Join `workspace_member` inside both task and run candidate queries and exclude archived projects. Do not trust client-supplied project identifiers and do not cache membership-bearing results across users. Owner means the runner when known, then the assignee, then the task creator. Keep the recent-completion horizon fixed at seven days so historical success does not make the operational query unbounded, and fail the whole response rather than presenting a partial list as complete.

Derive per-task attention from the task's current status, recipient relationship and monotonically increasing attention version. Store read and dismissal receipts separately per user, task and version. Pending decisions and meaningful failures apply to current workspace members, assignments to the current assignee, and completions for 30 days to the creator or assignee while they remain members. Receipts never mutate task state or execution authority.

Own each push registration by user, platform and installation. Replace its endpoint in place, prevent the same endpoint fingerprint from belonging to another account, and authenticated-encrypt the destination with the existing private data key. Keep operating-system permission on the client, because permission does not prove backend registration. Create a deduplicated delivery outbox entry for each eligible registration and task version, then revalidate current membership, attention state, recipient eligibility, preference and registration immediately before delivery. Send the stable delivery identity as the provider idempotency key, plus only generic copy, an inbox item identifier and a server-resolved task path. Resolve every clicked link against current access and version; stale notifications do nothing.

Two delivery transports exist and are configured separately. Task inbox notifications go through a deployment-owned HTTPS gateway that holds the Web Push VAPID private material and any APNs signing credentials; Polychat sends it only the protocol, platform, encrypted-at-rest destination and generic envelope. iOS Work notifications are still signed and sent to APNs by the API itself from `APNS_*` configuration, keyed to the signed-in user, bundle and APNs environment, with tokens rejected by APNs invalidated in place. Prefer the gateway for new delivery categories; a later change that moves the iOS Work path behind it should not alter any authority rule in this record. Live Activities are outside this boundary.

A notification is a hint, never proof of access or current state. Recheck membership when a client opens one, and expose compact run detail and task interactions only through the existing authorised endpoints. Registering a device grants no membership, runner authority, connector credential or approval capability.

## Consequences

Attention changes immediately with task, run and current membership state and introduces no scheduler, queue or execution authority. It deliberately does not copy conversation prose, connector credentials, command output or hidden reasoning. Offset pagination has deterministic ordering, but concurrent transitions can move an item between pages, so clients refresh rather than treating a page as a snapshot.

Inbox reads, dismissals and old provider messages cannot change a task or bypass current Work authority. Registration replacement and sign-out are recoverable per installation, at the cost of an outbox, an encryption key and provider credentials that operators must configure and monitor. Generic alerts are less descriptive on the lock screen by design. Local contract validation cannot prove external APNs or browser delivery without those credentials and real devices.
