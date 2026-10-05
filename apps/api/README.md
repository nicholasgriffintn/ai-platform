# Polychat API

Use the [setup reference](../../.agents/skills/polychat-setup/SKILL.md) for local configuration and validation.

## Enterprise identity

Configure one OIDC connection per workspace in **People & access → Enterprise sign-in** as the workspace owner. Register a confidential client using HTTP Basic client authentication, the exact callback shown after saving, and S256 PKCE. Use RS256 or ES256 ID tokens with a verified email and a complete array of groups.

Map explicit groups to member or admin roles. Admin takes precedence when several groups match; group claims never grant workspace ownership or a platform role. Work access still requires each person's existing Pro entitlement.

Share the connection's sign-in link or connection ID. Web and desktop sign-in use the same verified identity flow; desktop returns through its existing one-use native exchange. Existing accounts must explicitly link from **Account → Company access** while signed in to that account in the browser. Matching email addresses never merge accounts.

Refresh managed access from **Account → Company access** even after the workspace disappears from the workspace list. A verified sign-in grants access until the earlier of the ID token expiry and 15 minutes. Missing, excessive or unmapped groups revoke managed membership; cached sync audiences do not retain earlier recipients.

Save with the current `expectedRevision` to rotate credentials or change mappings. Saving invalidates previous grants and in-flight sign-ins; disabling works even when discovery is unavailable. Disconnecting revokes managed access and retains inactive membership records. Manual members and the owner remain available, and converting a managed role to manual access requires confirmation.

Create, read, update and disconnect through `/workspaces/:workspaceId/identity` using POST, GET, PATCH and DELETE. Read the current user's linked connections through `GET /auth/enterprise/connections`. Configuration responses omit client secrets; encrypted credentials bind the connection, issuer, client ID and revision.

Apply migration `0060_enterprise_identity` before the new API. Its `active_workspace_member` view is the authority source for membership reads, conversation access, notifications and sync delivery; keep the view's connection revision, enabled state and lease predicates intact. Keep membership writes on the base table and recheck current actor authority atomically when granting manual access.

Group provisioning refreshes at sign-in. Removing someone only in Polychat does not remove their identity provider group: a later verified sign-in can grant access again. Remove the upstream group, disable the connection or disconnect it to prevent reprovisioning. Issuer and client ID are immutable; replace the connection when either changes.
