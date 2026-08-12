# Operate Composio recipe connectors

Composio is the sole connection and execution authority for every enabled Composio auth config. Polychat does not keep provider OAuth clients, provider tokens, handwritten tool maps, or a same-provider fallback.

## Configure the environment

- Set `COMPOSIO_API_KEY` as an API Worker secret. It must belong to the project whose enabled auth configs should appear in Polychat. Grant it read access to auth configs and tools, and read/write access to connected accounts and sessions. A read-only key can list the catalogue but cannot connect or execute tools.
- Set `COMPOSIO_USER_NAMESPACE` to a short, stable value unique to the deployment, such as `preview` or `production`. Changing it requires users to reconnect.
- Set `API_BASE_URL` to the public API origin and `APP_BASE_URL` to the corresponding web application origin.
- In Composio, set **Settings → General → Configuration → Callback verifier URL** to `${API_BASE_URL}/apps/connectors/composio/verify`.

Do not configure provider OAuth client IDs or secrets in Polychat. The callback verifier is enabled in the Composio project; there is no duplicate application boolean.

## Synchronise the configured catalogue

Run the synchroniser whenever an auth config is enabled, disabled, replaced, or its tool restrictions change:

```sh
pnpm --filter @assistant/api connectors:sync
```

The command uses Composio's REST API to:

- list every enabled auth config and verify each one through its detail endpoint;
- list every current, non-deprecated tool available to each auth config;
- fetch the current toolkit metadata and version; and
- write a compact, complete index as minified generated JSON.

The generated connector ID is always the exact toolkit slug. If a toolkit has multiple enabled auth configs, the connector contains each real auth-config ID and the profile UI asks which one to connect. The generator never invents aliases or suffixed provider IDs.

The index stores provider metadata, categories, logos, auth-config IDs, versions, scopes, counts, exact tool slugs, auth-config availability, and read/write access. It deliberately excludes input/output schemas and descriptions; Composio Session search returns those current contracts when a model chooses a connector and describes its use case.

The current checked-in snapshot contains 131 enabled auth configs, 130 exact toolkit connectors, and 12,505 unique tools. Treat a synchronisation diff as an upstream contract change: review it, run the connector validation, and deploy the generated JSON with the code.

## Verify connections

Use this callback identity verifier for OAuth links:

```text
https://<public-api-host>/apps/connectors/composio/verify
```

The route requires the connecting user's authenticated browser session. In deployed environments it redeems Composio's single-use `session_uri`, verifies the returned account, toolkit, and auth-config ID, then redirects to the connector profile. Logs and Sentry events redact the verifier URI.

Composio cannot call an undeployed localhost identity verifier. During local development, its ordinary Connect Link callback instead appends `status` and `connected_account_id`. The same authenticated route accepts that documented callback, fetches the exact account under the signed-in namespaced user, and rejects accounts with an unknown toolkit, auth config, owner, or inactive status. Use a public HTTPS deployment or tunnel only when testing the `session_uri` identity-verification path itself.

## Runtime behaviour

- **Connect:** Polychat validates the generated auth-config ID against Composio. Managed OAuth uses a Connected Accounts link; hosted credential entry uses a connection-management Session link.
- **Discover:** `use_recipe_connector` creates a Session scoped to the user, connected account, toolkit, auth config, and recipe operation allowlist. Session search returns only the relevant current schemas and execution guidance.
- **Execute:** Polychat verifies the Session owner and exact enabled tool before Session execution. Arguments pass through unchanged, and the completed Session is deleted.
- **Function registry:** Composio actions are not registered as thousands of Polychat functions. Only the stable connector function enters the global function and dynamic-app catalogues.
- **Write tools:** require approval through the existing tool permission path.
- **Disconnect:** managed OAuth accounts are revoked upstream before their Composio record is deleted; credential-based links are deleted without pretending they support OAuth revocation.
- **Multiple accounts:** execution pins the Session to the most recently connected eligible active account. Polychat does not delete older accounts or enable multi-account execution implicitly.

GitHub and Cloudflare recipe connectors use Composio like every other configured toolkit. The separate GitHub App remains only for sandbox repository access. Devin, Hindsight, Honcho, and Netlify remain local API-key services because they are not manual OAuth connectors.

## Migrate existing credentials

Apply migrations `0058_remove_migrated_connector_credentials.sql` and `0059_remove_unconfigured_oauth_connectors.sql` through the normal D1 migration process. They deliberately purge the old recipe credentials and installed recipes that referenced removed manual OAuth providers. Users reconnect through Composio; no compatibility path reads the deleted credentials.
