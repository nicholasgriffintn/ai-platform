# Lease identity-managed workspace access

Enterprise groups can change after sign-in. A stored member row must not keep granting access after its identity provider connection is disabled, reconfigured or no longer refreshed.

Bind identities to an immutable connection and verified OIDC subject. Keep issuer and client ID fixed, require explicit account linking, and never merge accounts by email. Use the existing OAuth state store, PKCE, nonce verification, asymmetric JWT verification and native exchange rather than adding another authentication stack.

Lease group-managed member or admin access until the earlier of token expiry and 15 minutes. Read current membership through `active_workspace_member`, which checks the connection's workspace, enabled state, revision and lease expiry. Query live membership for sync recipients; retain caches only for resource-to-workspace relationships.

Keep manual membership outside the identity lease. Preserve owner access for recovery, confirm conversion to manual access in the UI, and clear lease fields when a manual invitation or ownership transfer changes the membership. Fence privileged role changes with the current actor and target membership in the same database write.

Provision groups at verified sign-in. This bounds stale upstream permissions while avoiding stored refresh tokens and background identity impersonation, at the cost of requiring periodic sign-in. Do not claim immediate upstream deprovisioning; remove group membership or disable the connection to prevent a later sign-in from provisioning access again.
