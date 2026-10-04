# Operate Composio connectors

Composio owns credentials and execution schemas for its configured connectors. Polychat owns scoped authority, approvals, event mappings and cleanup. Read [the connector decision](../architecture/decisions/0017-bind-connector-execution-to-local-authority.md) before changing those boundaries.

## Configure and synchronise

- Set API secrets `COMPOSIO_API_KEY` and `COMPOSIO_WEBHOOK_SECRET` for the matching Composio project.
- Set a stable, environment-specific `COMPOSIO_USER_NAMESPACE`. Changing it requires reconnection.
- Bind `PRIVATE_ASSETS_BUCKET` and set matching `API_BASE_URL`/`APP_BASE_URL`.
- Set Composio's callback verifier to `${API_BASE_URL}/apps/connectors/composio/verify` and the signed webhook to `${API_BASE_URL}/webhooks/composio`.
- Subscribe to `composio.trigger.message` and `composio.connected_account.expired`.
- Apply the current migration set for the authorised target; do not use historical migration numbers from older guides.

After enabled auth configs or tool restrictions change, synchronise the catalogue from the owning package:

```sh
pnpm --filter @ngriffin_uk/polychat-library-composio composio:sync
pnpm --filter @ngriffin_uk/polychat-library-composio composio:sync --write
```

The command defaults to a dry run, reads `COMPOSIO_API_KEY` from the environment or `apps/api/.dev.vars`, and regenerates `packages/library-composio/src/data/toolkits/`, its data index and the provider id list in `packages/schemas/src/generated/`. Pass `--snapshot <path>` to replay a saved manifest without network access. Review the generated catalogue and risk hints, validate connectors and deploy. Exact toolkit/auth-config/tool IDs are authoritative; catalogue counts and schemas are not copied here.

`@ngriffin_uk/polychat-library-composio` owns the toolkit data, schema and session handle contract; `@ngriffin_uk/polychat-ai-integrations` owns the provider registry, operation policy and Composio clients the API calls. Keep new catalogue behaviour in the library and new provider policy in the primitives package rather than in the API.

## Connections and sessions

Keep the connecting browser signed in. Deployed callbacks redeem the single-use verifier URI; local Connect Link callbacks may return `status` and `connected_account_id`. Both paths verify the exact account against the namespaced user, toolkit, auth config and active state.

Users label and select accounts in Profile. Sessions pin the selected active account or the newest eligible fallback. Disconnect removes matching accounts, with provider revocation where supported. Composio credentials are not stored locally.

Expose only opaque local Session handles. The run's finaliser closes its Sessions; browser disconnection does not close a running turn. Maintenance retries expired or cleanup-pending rows. Do not delete journal evidence before confirming upstream cleanup.

## Approvals and events

Interactive writes create an expiring receipt for the exact persisted tool call. Approve or reject through the normal conversation control; API resolution uses `PUT /apps/connectors/approvals/<approval-id>`. Continue the same completion with `connector_approval_id`, never replacement action arguments.

Duplicate consumed approvals reuse their stored result. **Consumed without a result means indeterminate execution:** inspect the provider log and target system before creating another action. Do not replay automatically. Scheduled and event-triggered runs cannot perform approval-gated writes.

Triggers belong to one active installation and account. Pause/resume them with the recipe; delete upstream before removing local authority. Signed events still need an exact active mapping. HTTP 200 with `queued: false` acknowledges an unmatched or inactive mapping and is not a retryable delivery error.

An optional **Only run when** condition is evaluated against bounded, redacted event data. False, uncertain or unavailable judgement skips the occurrence. Duplicate provider delivery reuses the trigger/event receipt and does not call the decision provider again. If an evaluation lease expires, the next delivery may reclaim it; after a task is queued, its deterministic identity remains authoritative even if receipt settlement was interrupted.

## Private files

Use authorised Source/Output references or the `$assistantFile` marker. The bridge validates scope, relative mount paths, MIME, size, transfer time and presigned hosts. Imported files become private governed Outputs; provider URLs are not durable results. Restore the private bucket/key when file discovery fails rather than making files public.

## Diagnose and roll back

| Symptom                 | Check                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Callback denied         | Signed-in browser, matching origins/namespace, generated auth-config IDs and account ownership                 |
| Webhook 401/503         | Unmodified raw body and signature headers, timestamp, matching signing secret                                  |
| Valid event not queued  | Trigger and installation status, account, namespace, trigger slug, condition receipt and decision availability |
| Session rejected        | Expiry and original run/conversation/recipe/operation scope; rediscover instead of substituting an upstream ID |
| Approval indeterminate  | Stored receipt/result, Composio log and actual external effect                                                 |
| Cleanup attempts rising | Upstream Session deletion permission and provider availability                                                 |

Correlate Activity's run, completion, installation, local session handle and Composio log IDs. Keep arguments, result bodies and credentials out of Activity logs.

Before rollback, pause triggers and confirm upstream state. Disable affected auth configs/tools, synchronise and review the catalogue, then deploy the selected version. Do not restore deleted legacy credentials or remove cleanup rows to hide failures. Verify read execution, approval/rejection/expiry, duplicate handling, private files and trigger pause/resume with a non-production account before expanding use.

## Persistent knowledge sources

Add a source from **Sources → Synced knowledge → Add knowledge source**. Select a provider with a registered knowledge capability, choose your connection and enter its location. The existing connector catalogue supplies the provider-specific form labels and supported content. Personal sources stay personal; project sources require a project admin and verified upstream access for every current workspace member.

Run migrations `0058_source_knowledge` and `0059_source_sync` through the documented migration process when deployment is authorised. Keep `TASK_QUEUE`, the existing embedding bindings and the stable `EMBEDDING_SCOPE_SECRET` configured. The normal scheduler discovers unindexed sources and due source scans; no additional worker or search service is required.

Check indexing status beside each source and scan status in the synced knowledge panel. Pause a sync to immediately exclude its documents, retry to start a fresh scan, and remove it to delete its managed source rows. Keep stored vector cleanup records until their original target confirms deletion.

Expect scans every 15 minutes and permission evidence to expire after at most 20 minutes, or earlier when a grant expires. Drive is the current adapter and supports Google Docs and text files; group-only sharing, spreadsheets and binary Drive documents are excluded. Extend the existing connector registry with an adapter for another provider, without changing the shared worker or storage model. Validate a live source containing an edit, deletion and permission-only revocation against its deployed account before enabling a production corpus.

Index uploaded source files through the existing private-file authority and document conversion service. Limit uploads for extraction to 25 MiB and extracted text to 256 KiB; exclude images, audio and video from this text index. Use the source retry action after repairing an extraction or provider failure.
