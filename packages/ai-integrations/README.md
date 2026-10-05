# @ngriffin_uk/polychat-ai-integrations

Integration provider primitives for Polychat. The package owns the connector provider registry built from `library-composio` data and the local API-key providers, operation access and approval policy, write-outcome classification, the connector connection vocabulary, the API-key executors, the Composio REST and trigger clients, and the Pashi contract, catalogue search and client. Hosts import from here rather than carrying their own connector tables or clients.

```ts
import {
  connectorOperationRequiresApproval,
  connectorProviders,
  createComposioToolSession,
  executeDevinOperation,
  getConnectorProviderConfig,
  getPashiClient,
  normaliseConnectorOperationFailure,
} from "@ngriffin_uk/polychat-ai-integrations";

const provider = getConnectorProviderConfig("gmail");
const needsApproval = connectorOperationRequiresApproval("gmail", "GMAIL_SEND_EMAIL");
const sessionId = await createComposioToolSession({
  env,
  userId,
  provider,
  connectedAccount,
  allowedToolSlugs,
});
const pashi = getPashiClient(env);
```

`getConnectorProviderOperationAccess` and `connectorOperationRequiresApproval` encode read, write and destructive policy, and `normaliseConnectorOperationFailure` classifies uncertain or rate-limited writes so callers never blindly repeat a non-idempotent action. The Composio client validates auth configs and session scope before every upstream call and exposes opaque session handles; the trigger client manages Composio trigger instances. The Pashi client parses the vendor catalogue, validates tool fields and exposes coded errors. The API keeps the function tool descriptors and response shaping.

## Host

The Composio clients read `COMPOSIO_API_KEY` and `COMPOSIO_USER_NAMESPACE` from a structural environment, the Pashi client reads `PASHI_API_KEY`, and GitHub App helpers read the matching `GITHUB_APP_*` and `APP_BASE_URL` fields, so the API passes its own `IEnv` without importing host types.

The API keeps what is Polychat's: connection authority, approvals and replay, the private file bridge, run lifecycle, persistence and routes.
