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

## Review custom service definitions

Keep custom MCP services separate from the model provider registry. Use `createIntegrationSnapshot` to validate a public HTTPS endpoint, reject duplicate tool names and fingerprint the authentication mode, input and output schemas, and behaviour annotations. Tool ordering and description edits preserve the fingerprint; endpoint, schema and behaviour changes require a new reviewed definition.

```ts
import {
  createIntegrationSnapshot,
  getGrantedIntegrationTools,
} from "@ngriffin_uk/polychat-ai-integrations";

const snapshot = await createIntegrationSnapshot({
  endpoint: "https://tools.example.com/mcp",
  authentication: "bearer",
  tools: discoveredTools,
});
const projectTools = getGrantedIntegrationTools(snapshot, ["search_orders"]);
```

Persist immutable revisions in the API and pin project grants to a reviewed revision and exact operation names. A new service action never expands a project grant. Keep credentials in each runner's encrypted connection record rather than the shared definition or model input, and invalidate approval identity when that connection is replaced.

Use `discoverNativeMcpSnapshot` for authenticated Streamable HTTP discovery and `executeNativeMcpOperation` for a reviewed action. The official client negotiates the protocol, bounds discovery to 500 actions, 50 pages and a 2 MiB definition, and closes its transport after each request. The transport accepts only the fixed public HTTPS endpoint, refuses redirects, limits each response to 2 MiB and stops after 30 seconds.

Validate arguments before approval. Recheck the selected action's input/output schemas and behaviour annotations against the saved revision, then use `beforeExecute` to reload local authority and consume the exact durable approval immediately before dispatch. An added, ungranted action does not invalidate existing grants.

Return bounded text and structured results with secrets redacted. Do not fulfil server sampling, elicitation or input requests, follow resource links, or retry an action whose outcome is unknown. Reconcile the service's actual state before requesting another approval.
