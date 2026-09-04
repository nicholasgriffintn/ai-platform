# Operate Composio connectors

Composio owns credentials and execution schemas for its configured connectors. Polychat owns scoped authority, approvals, event mappings and cleanup. Read [the connector decision](../architecture/decisions/0013-composio-run-approval-and-event-boundaries.md) before changing those boundaries.

## Configure and synchronise

- Set API secrets `COMPOSIO_API_KEY` and `COMPOSIO_WEBHOOK_SECRET` for the matching Composio project.
- Set a stable, environment-specific `COMPOSIO_USER_NAMESPACE`. Changing it requires reconnection.
- Bind `PRIVATE_ASSETS_BUCKET` and set matching `API_BASE_URL`/`APP_BASE_URL`.
- Set Composio's callback verifier to `${API_BASE_URL}/apps/connectors/composio/verify` and the signed webhook to `${API_BASE_URL}/webhooks/composio`.
- Subscribe to `composio.trigger.message` and `composio.connected_account.expired`.
- Apply the current migration set for the authorised target; do not use historical migration numbers from older guides.

After enabled auth configs or tool restrictions change, run the authorised `pnpm --filter @assistant/api connectors:sync`, review the generated catalogue and risk hints, validate connectors and deploy. Exact toolkit/auth-config/tool IDs are authoritative; catalogue counts and schemas are not copied here.

## Connections and sessions

Keep the connecting browser signed in. Deployed callbacks redeem the single-use verifier URI; local Connect Link callbacks may return `status` and `connected_account_id`. Both paths verify the exact account against the namespaced user, toolkit, auth config and active state.

Users label and select accounts in Profile. Sessions pin the selected active account or the newest eligible fallback. Disconnect removes matching accounts, with provider revocation where supported. Composio credentials are not stored locally.

Expose only opaque local Session handles. The run's finaliser closes its Sessions; browser disconnection does not close a running turn. Maintenance retries expired or cleanup-pending rows. Do not delete journal evidence before confirming upstream cleanup.

## Approvals and events

Interactive writes create an expiring receipt for the exact persisted tool call. Approve or reject through the normal conversation control; API resolution uses `PUT /apps/connectors/approvals/<approval-id>`. Continue the same completion with `connector_approval_id`, never replacement action arguments.

Duplicate consumed approvals reuse their stored result. **Consumed without a result means indeterminate execution:** inspect the provider log and target system before creating another action. Do not replay automatically. Scheduled and event-triggered runs cannot perform approval-gated writes.

Triggers belong to one active installation and account. Pause/resume them with the recipe; delete upstream before removing local authority. Signed events still need an exact active mapping. HTTP 200 with `queued: false` acknowledges an unmatched or inactive mapping and is not a retryable delivery error.

## Private files

Use authorised Source/Output references or the `$assistantFile` marker. The bridge validates scope, relative mount paths, MIME, size, transfer time and presigned hosts. Imported files become private governed Outputs; provider URLs are not durable results. Restore the private bucket/key when file discovery fails rather than making files public.

## Diagnose and roll back

| Symptom                 | Check                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Callback denied         | Signed-in browser, matching origins/namespace, generated auth-config IDs and account ownership                 |
| Webhook 401/503         | Unmodified raw body and signature headers, timestamp, matching signing secret                                  |
| Valid event not queued  | Trigger and installation status, account, namespace and trigger slug                                           |
| Session rejected        | Expiry and original run/conversation/recipe/operation scope; rediscover instead of substituting an upstream ID |
| Approval indeterminate  | Stored receipt/result, Composio log and actual external effect                                                 |
| Cleanup attempts rising | Upstream Session deletion permission and provider availability                                                 |

Correlate Activity's run, completion, installation, local session handle and Composio log IDs. Keep arguments, result bodies and credentials out of Activity logs.

Before rollback, pause triggers and confirm upstream state. Disable affected auth configs/tools, synchronise and review the catalogue, then deploy the selected version. Do not restore deleted legacy credentials or remove cleanup rows to hide failures. Verify read execution, approval/rejection/expiry, duplicate handling, private files and trigger pause/resume with a non-production account before expanding use.
