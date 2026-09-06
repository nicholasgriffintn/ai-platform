# Native project-task interactions

- **Change:** iPhone can inspect and answer authoritative project-task questions and exact tool approvals, reconcile decisions made elsewhere and stop the exact run independently of voice controls.
- **Surfaces:** project-task API, stored Work conversations and native iOS.
- **Prerequisites:** deploy the API and schema contract before the updated iOS client. Apply the G04–G07 migrations before validating run replay; G08 adds no migration.
- **Risk if wrong:** a stale card could appear actionable, a failed request could look accepted, or a cached project conversation could expose controls after membership revocation.
- **Commits:** none yet.

## Verify

- [ ] Open a project-task conversation on a physical iPhone while it waits on two or three questions. Answer a structured choice and a written question, use VoiceOver to traverse every prompt and option, then send. Confirm one sending state appears and the task continues only after server acknowledgement.
- [ ] Repeat with a tool approval. Inspect the tool name and reason, reject it, and confirm the task continues without that permission. Start a new exact approval and approve it; confirm no broader or future approval is implied.
- [ ] Disable network access before sending an answer and an approval. Confirm each card reports a retryable failure and retains the entered answer or chosen decision. Restore the network, retry once and confirm there is one recorded response.
- [ ] Resolve the same card on web while it is open on iPhone. Confirm iPhone changes to already resolved within the active two-second polling cadence and cannot submit the stale card.
- [ ] Submit simultaneously on web and iPhone. Confirm one exact interaction wins, the other receives conflict reconciliation, and only one user response resumes the task.
- [ ] Leave an interaction unresolved beyond its seven-day recovery window. Confirm it displays expired, cannot authorise work and offers refresh.
- [ ] Force task dispatch to fail after the answer or approval is saved. Confirm iPhone reports that the response was received but provider continuation was interrupted, without presenting an approval as rejected.
- [ ] Revoke the iPhone user's workspace membership while a card is open. Confirm refresh and submission cease to expose or authorise project work; restoring membership and reopening must fetch fresh task state.
- [ ] Begin a project task, start voice recording, then stop recording. Confirm the task keeps running. Use the task stop control and confirm it sends the current run ID and observed attempt, first shows stop requested, and leaves an unrelated pending decision unresolved.
- [ ] Test Dynamic Type, portrait and landscape, light and dark appearance, Switch Control and VoiceOver. Confirm prompts, option descriptions, sending/failure text and approve/reject controls remain readable and reachable without relying on colour.
- [ ] Inject an unknown interaction type and a protocol version newer than the client. Confirm the card is visible but non-actionable, directs the person to update or refresh, and the rest of the conversation remains usable.

**Supported interaction types:** protocol version 1 supports project-task questions with one to three prompts, up to five structured options per prompt and optional written answers, plus exact tool approval or rejection. It does not grant shell-session scopes, answer arbitrary future interaction types or implement push delivery.

**Task destination handoff:** notification and attention work may address `(workspaceId, projectId, taskId, conversationId?)`. Resolve current membership and task detail after opening; never treat the deep link, notification or cached message as authority.

**Stop and report if:** submission appears resolved before acknowledgement, a 409 remains actionable, an expired or unknown card can submit, a 403 falls back to cached authority, stop resolves a decision, or streamed interaction data is reduced to display text.
