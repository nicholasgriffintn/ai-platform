# Composio recipe connector operations

Composio is the sole connection and execution authority for every enabled Composio auth config. Polychat does not keep provider OAuth clients, provider tokens, handwritten tool maps, or a same-provider fallback.

## Configure the environment

- Set `COMPOSIO_API_KEY` as an API Worker secret. Use a key from the Composio project whose enabled auth configs should appear in Polychat. It needs read access to auth configs, toolkits, tools, and trigger types, plus read/write access to connected accounts, Sessions, Session mounts, and trigger instances.
- Set `COMPOSIO_USER_NAMESPACE` to a short, stable value unique to the deployment, such as `preview` or `production`. Changing it changes every derived Composio user ID and requires users to reconnect.
- Set `COMPOSIO_WEBHOOK_SECRET` as an API Worker secret. Use the signing secret for the webhook that targets this deployment. Rotate the Composio setting and Worker secret together.
- Bind `PRIVATE_ASSETS_BUCKET` to a private R2 bucket. The file bridge must not use the public asset bucket.
- Set `API_BASE_URL` to the public API origin and `APP_BASE_URL` to the corresponding web application origin.

Do not configure provider OAuth client IDs or secrets in Polychat. The callback verifier is enabled in the Composio project; there is no duplicate application boolean.

## Configure Composio callbacks and webhooks

In Composio, set **Settings → General → Configuration → Callback verifier URL** to:

```text
${API_BASE_URL}/apps/connectors/composio/verify
```

Create a webhook for this deployment with this endpoint:

```text
${API_BASE_URL}/webhooks/composio
```

Subscribe it to these event types:

- `composio.trigger.message` to start an installed recipe from an active trigger;
- `composio.connected_account.expired` to mark triggers for an expired account as errored.

The webhook handler verifies `webhook-id`, `webhook-timestamp`, and every `v1` value in `webhook-signature` against the raw request body. Requests outside the five-minute timestamp tolerance fail before JSON parsing. Do not put this endpoint behind browser authentication or CSRF middleware.

Use a distinct webhook and signing secret for each environment. Delivering a production event to preview cannot find a matching namespaced user and trigger, but environment isolation should not depend on that secondary check.

## Synchronise the configured catalogue

Run the synchroniser whenever an auth config is enabled, disabled, replaced, or its tool restrictions change:

```sh
pnpm --filter @assistant/api connectors:sync
```

The command uses Composio's REST API to:

- list every enabled auth config and verify each one through its detail endpoint;
- list every current, non-deprecated tool available to each auth config;
- fetch current toolkit metadata and versions; and
- write a compact, complete index as minified generated JSON.

The generated connector ID is always the exact toolkit slug. If a toolkit has several enabled auth configs, the connector retains every real auth-config ID. The generator never invents aliases or suffixed provider IDs.

The index stores provider metadata, categories, logos, auth-config IDs, versions, scopes, counts, exact tool slugs, auth-config availability, and Composio's read-only, destructive, idempotent, and open-world hints. It deliberately excludes input and output schemas and descriptions; Session search returns those current contracts when a model chooses a connector and describes its use case.

The current checked-in snapshot contains 131 enabled auth configs, 130 exact toolkit connectors, and 12,505 unique tools. Treat a synchronisation diff as an upstream contract change. Review risk-hint changes, run connector validation, and deploy the generated JSON with the code.

## Apply the database migration

Apply migration `0060_watery_gabe_jones.sql` before deploying code that creates connector Sessions, approvals, or triggers. It adds:

- `composio_connector_session`, the durable tool-Session lease and cleanup journal;
- `connector_operation_approval`, the exact-action approval receipt; and
- `recipe_composio_trigger`, the local trigger-to-installation authority mapping.

Use the normal target-specific D1 command:

```sh
pnpm --filter @assistant/api db:migrate:local
pnpm --filter @assistant/api db:migrate:preview
pnpm --filter @assistant/api db:migrate:prod
```

Apply only the command for the target environment. Migrations `0058_remove_migrated_connector_credentials.sql` and `0059_remove_unconfigured_oauth_connectors.sql` remain breaking prerequisites: they purge old recipe credentials and installations that referenced removed manual OAuth providers. Users reconnect through Composio; no compatibility path reads the deleted credentials.

## Verify connections and account selection

Use this callback identity verifier for OAuth links:

```text
https://<public-api-host>/apps/connectors/composio/verify
```

The route requires the connecting user's authenticated browser session. In deployed environments it redeems Composio's single-use `session_uri`, fetches the returned connected account under the namespaced user, and verifies toolkit, auth config, owner, and active state before redirecting to the connector profile. Logs and Sentry events redact the verifier URI.

Composio cannot call an undeployed localhost identity verifier. During local development, its ordinary Connect Link callback instead appends `status` and `connected_account_id`. The same authenticated route fetches that exact account under the signed-in namespaced user and applies the same scope checks.

Users can label and select active Composio accounts from the connector details in Profile. Polychat stores only the alias and selected connected-account ID; credentials stay in Composio. New Sessions pin the explicit active selection. If no valid selection exists, execution uses the most recently connected eligible active account for compatibility.

Disconnecting a connector removes all matching Composio accounts. Managed OAuth accounts are revoked at the provider before deletion where Composio supports revocation; credential-based accounts are deleted without claiming provider revocation.

## Understand the runtime boundary

- **Connect:** managed OAuth uses a Connected Accounts link. Hosted credential entry uses a connection-management Session link.
- **Discover:** `use_recipe_connector` creates a Session scoped to the namespaced user, explicit account, toolkit, auth config, recipe operation allowlist, connector run, completion, recipe, and installation. Session search supplies current schemas and execution guidance.
- **Handle:** the model receives an opaque `ccs_…` local handle, never the upstream `trs_…` Session ID. Execution atomically claims that handle and rechecks its full scope and exact operation allowlist.
- **Execute:** arguments pass to Composio unchanged after authorised Source or Output file references are staged. Polychat verifies the selected connected account is still active immediately before the call.
- **Close:** normal, streaming, agent, failure, and cancellation paths delete tracked upstream tool Sessions. A failed deletion marks the local row for retry.
- **Recover:** the 15-minute recipe schedule also leases and deletes expired or cleanup-pending Sessions in batches of 50. One cleanup failure does not block recipe scheduling or approval cleanup.
- **Function registry:** Composio actions are not registered as thousands of Polychat functions. Only the stable connector function enters the global function and dynamic-app catalogues.

Tool Sessions expire locally after 30 minutes. Hosted credential connection-management Sessions enter the same journal with a one-hour expiry. The cleanup lease lasts five minutes; a failed reaper deletion is retried after 15 minutes.

## Operate exact-action approvals

An interactive operation needs approval when the generated catalogue does not mark it read-only or marks it destructive. Discovery remains available without approval.

The connector tool first persists its tool call and a `status: pending` result with a `coa_…` approval ID and a ten-minute expiry. Chat renders an approval card; approving resolves the receipt and starts an authenticated server replay from that stored conversation boundary. Operators can exercise the same authenticated endpoint directly:

```http
PUT /apps/connectors/approvals/<approval-id>
Content-Type: application/json

{ "resolution": "approved" }
```

Use `rejected` to deny the action. After approval, continue the same completion with `connector_approval_id`; do not send operation arguments for execution. Client messages are untrusted. The server reloads the persisted tool call and revalidates the user, connector run, completion, provider, exact operation, canonical argument digest, Session, selected account, recipe, installation, and project scope. It consumes the receipt, executes once, persists the terminal tool result, and then lets the model summarise with tools disabled.

A duplicate request for a consumed receipt returns the stored terminal result for summarisation instead of executing again. If the receipt is consumed but no terminal result exists, execution may have reached the provider; the server fails closed with an indeterminate result and does not retry the external action automatically.

Conversation reads resolve each approval ID against the current receipt state. Reloaded clients therefore show approved, rejected, completed, or expired status without restoring approval buttons from the original pending tool result. Expired pending receipts are removed by maintenance immediately; resolved receipts remain for 30 days to preserve recent conversation state.

Scheduled and event-triggered runs cannot perform approval-gated writes. Run the recipe interactively when an external change needs human confirmation. The 15-minute maintenance schedule deletes expired receipts independently of recipe scheduling.

## Operate event triggers

Event triggers belong to a user-owned recipe installation and one explicit active connected account. Users create, pause, resume, and delete them from the installed recipe's event-trigger dialog. Trigger-type discovery is live from Composio, so configuration fields can change independently of the checked-in tool catalogue.

Creating a trigger verifies:

- the installation is active and owned by the signed-in user;
- the provider belongs to the recipe;
- the trigger type belongs to the provider's exact toolkit; and
- the selected account belongs to the namespaced user, uses an enabled auth config, and is active.

Pausing or resuming a recipe applies the same state to its remote triggers. A failed remote state change leaves the local trigger in `error` with `last_error`. Deleting an individual trigger removes it upstream before removing the local authority record. Recipe deletion also removes its upstream triggers and fails rather than silently orphaning them.

For every signed trigger message, the webhook rechecks the external trigger ID, namespaced user, connected account, trigger slug, local status, installation owner, project, and installation status. A deterministic task ID derived from the event and trigger IDs makes redelivery idempotent. The queued recipe retains the installation's user and project scope, and its bounded event input explicitly tells the model to treat all event fields as untrusted data.

An HTTP 200 response with `queued: false` means the signature was valid but the event did not match an active local trigger and installation. This is an intentional acknowledgement, not a transient delivery failure.

## Operate the file bridge

Connector inputs may reference an authorised private file using a Polychat private Source or Output URL, or an explicit marker:

```json
{
  "$assistantFile": {
    "kind": "source",
    "id": "<source-id>",
    "path": "documents/input.pdf"
  }
}
```

The bridge verifies personal or project access, reads from `PRIVATE_ASSETS_BUCKET`, and uploads through a Composio Session mount presigned URL. It accepts only HTTPS Amazon S3 or Cloudflare R2 hosts, relative traversal-free paths, valid MIME types, files no larger than 25 MiB, and transfers that complete within 15 seconds.

Composio results are imported only when they contain an explicit file descriptor for the `/mnt/files` mount. The bridge downloads the bounded file into the private bucket, creates a governed Output in the conversation and project execution scope, and replaces the remote descriptor with `$assistantOutput` metadata. It never persists a presigned provider URL as the result.

Discovery fails with a configuration error when a returned schema accepts files but `PRIVATE_ASSETS_BUCKET` or `COMPOSIO_API_KEY` is unavailable. Do not fall back to public asset URLs. Disable the affected tool in the Composio auth config and synchronise the catalogue if the private bridge cannot be restored promptly.

## Observe and correlate runs

Every succeeded or failed Composio operation attempts to create an Activity record with kind `connector_operation`. Use these fields to correlate local and upstream state:

- `connectorRunId` and Activity `groupId` for one server request;
- `completionId`, `recipeId`, and `installationId` for the local execution;
- `provider`, `operation`, and `selectedAccountId` for the exact authority used;
- `sessionHandle` for the opaque local Session lease; and
- `composioLogId` for the corresponding Composio execution log.

Activity projection is best effort and does not fail an operation when persistence is unavailable. It deliberately excludes arguments, result bodies, credentials, presigned URLs, and upstream Session IDs. Use the Composio log ID in its dashboard for provider request details, then use the local run and completion IDs for Polychat logs and Activity history.

Monitor the `composio_connector_session` table for expired rows and increasing `cleanup_attempts`, the `recipe_composio_trigger` table for `error` states, Worker warnings from `services/apps/connectors/composio-cleanup`, and Composio webhook delivery failures.

Use this deployment order:

1. Apply migration `0060` and configure secrets, the private bucket, callback verifier, and signed webhook.
2. Synchronise and review the generated catalogue, especially risk-hint changes.
3. Deploy, then verify interactive read discovery and single-tool execution.
4. Verify exact write approval, rejection, expiry, stored-boundary mismatch rejection, duplicate-result reuse, and consumed-without-result failure.
5. Verify a private input file and imported output file with a non-production account.
6. Create one event trigger, pause it, and confirm signed delivery produces `queued: false`. Resume it, then confirm exactly one task is queued for repeated delivery.
7. Verify Activity correlation and wait for one 15-minute cleanup cycle before expanding connector or trigger use.

## Roll back safely

- Pause recipe triggers in Polychat before disabling or deleting the Composio webhook. Confirm remote trigger state in Composio.
- Disable affected auth configs or tools in Composio, run `connectors:sync`, review the diff, and deploy the regenerated catalogue.
- Deploy the previous application version. Leave migration `0060` in place; its tables are additive and old code ignores them.
- Do not delete Session rows to hide cleanup failures. Remove the matching upstream Session first, then delete the local row only after confirming its ID.
- Do not roll back migrations `0058` or `0059` by restoring old encrypted credentials. Reconnect users through Composio.

## Troubleshoot failures

- **Callback returns 400 or 403:** confirm the browser is signed in, the callback verifier URL uses the same environment, the namespace is unchanged, and the account's toolkit and auth-config IDs exist in the generated catalogue.
- **Webhook returns 401:** confirm the raw request is not rewritten by a proxy, all three webhook headers arrive unchanged, the signing secrets match, and clocks differ by less than five minutes.
- **Webhook returns 400:** only the two documented event types are accepted. Check the Composio subscription and payload version.
- **Webhook returns 503:** configure `COMPOSIO_WEBHOOK_SECRET` for the API Worker.
- **Webhook returns 200 with `queued: false`:** inspect trigger status, installation status, namespaced user, connected account, and trigger slug. Do not ask Composio to retry until the mapping is active.
- **Trigger shows `error`:** inspect `last_error`, restore the connected account or remote trigger, then retry pause/resume. An expired-account webhook marks every local trigger for that account as errored.
- **Session handle is rejected:** the handle is expired, already outside its original run/completion/recipe scope, or does not allow the requested operation. Start discovery again; never substitute an upstream `trs_…` ID.
- **Approval is rejected:** repeat discovery and the operation to create a new stored boundary and receipt. Do not transplant an approval ID into another completion or client-supplied action.
- **Approval is consumed without a result:** treat the provider outcome as indeterminate and reconcile it using the Composio log and target system before creating another action. Automatic replay is intentionally disabled in this state.
- **File discovery returns 503:** verify the private bucket binding and Composio key. File operations deliberately fail closed without both.
- **File transfer returns 400 or 502:** check the 25 MiB limit, MIME type, mount path, 15-second limit, and returned presigned host. Do not broaden the host allowlist without reviewing the provider's documented storage endpoints.
- **Cleanup attempts increase:** verify Composio API access to delete Sessions, find the local `sessionHandle`, and inspect the matching upstream Session. The reaper retries, so resolve the upstream error before deleting local evidence.
- **Activity has no Composio log ID:** the provider may have failed before returning one. Search local logs by `connectorRunId`, completion, provider, and operation.
