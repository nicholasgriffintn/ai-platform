# Operate custom integrations and project grants

Project access previously depended on recipe installations, while custom MCP servers depended on model-hosted tools. Use native custom integrations through the normal function runtime and grant exact built-in connector actions directly to projects.

## Prepare the API

Apply migration `0058_native_integrations.sql` through the normal authorised release process before deploying this change. Keep `JWT_SECRET` stable: it encrypts each person's account credentials, bound to that person, definition and endpoint. An encryption-key change requires reconnection.

Use public HTTPS Streamable HTTP MCP endpoints. Choose no authentication or a personal bearer token. The client uses the already locked official MCP client, negotiates supported protocol versions and closes each request's transport. It refuses redirects and bounds discovery, response size and elapsed time.

## Add and grant services

Open **Plugins** in Chat for a personal service, or in a Work project for a workspace definition. Workspace owners and admins curate definitions and project grants. Each member connects their own account, reviews the saved actions and receives only the exact actions enabled for that project.

Use the built-in integration's account dialog to grant connector actions without installing a recipe. Existing recipes keep their own operation restrictions. A project grant never grants another person's account, and teammate connection grants further narrow the runner's available actions.

Custom integrations participate in Plugins search, category and configured filters. Capability setup links open the relevant integration's account dialog.

## Review service changes

Select **Review service changes**, inspect added, removed and changed parameters, outputs or behaviour, then save the exact reviewed definition. Saving rechecks the service and rejects a preview that changed in the meantime.

Existing projects remain pinned to their earlier reviewed revision. Review the saved actions and explicitly save project access to upgrade. New service actions never expand an existing grant. A changed or removed granted action cannot run until a matching reviewed revision is granted.

## Approve and recover actions

The `use_mcp_integration` function first returns exact reviewed schemas available in the current scope. Each action then uses the existing durable connector approval flow for its exact arguments. Execution checks live scope, account identity and teammate grants again immediately before consuming the approval and dispatching the action.

Duplicate approval delivery reuses the stored result. A lost or invalid response after dispatch leaves an unknown outcome with no automatic retry. Inspect the service's actual state before requesting another approval.

Disconnect an account to invalidate its approvals. Remove a definition to revoke it across every project and atomically delete its stored credentials. Credential writes cannot recreate a connection for a revoked definition or departed member.

Keep service content untrusted. Native execution returns text and structured results, redacts secrets and does not fulfil sampling or credential/input requests, follow resource links or automatically import remote files. Scheduled and event-triggered custom actions cannot obtain interactive approval.
