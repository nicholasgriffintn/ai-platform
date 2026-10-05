# Scope channel work to threads

Status: accepted

## Problem

A shared Slack channel conversation mixes unrelated requests and replies outside their original threads. Queued work also needs a durable way to observe a mute or stop accepted while a model request is running.

## Decision

Bind each channel to its provider workspace and an explicit sender allowlist. Derive Slack conversation identity from the binding, workspace, channel and root thread; keep Telegram conversation identity per bound chat. Validate the configured Slack installation when creating a binding.

Store a thread revision and muted state in D1. Admit mention-triggered threads and direct messages, then accept follow-ups in an active thread; require `polychat resume` to unmute. Apply controls at webhook receipt, reject older or duplicate control mutations, and increment the revision before requesting cancellation through the existing run journal.

Pin the thread and binding revisions in queue tasks and resolved run configuration. Recheck them at execution, during the existing run cancellation checks, and before reply delivery. Keep outbound delivery receipts, and do not cancel a newer run when Slack retries an earlier stop event.

Use the existing personal and project authority boundaries. An allowed external sender acts under the binding creator’s access; project membership grants no personal credentials. Restrict project binding creation and configuration updates to owners and administrators, and retain creator ownership of the binding.

## Transition and trade-offs

Disable existing bindings in migration `0058_channel_threads`. Recreate them with explicit workspace and sender permissions; reject old queued binding tasks without thread authority. Do not infer sender authority or retain a channel-wide conversation path.

Use one configured bot installation per deployment. Stop prevents subsequent work and suppresses late replies; an external write already in progress may still complete. Reuse the existing operation and delivery journals for uncertain outcomes rather than replaying external writes.
