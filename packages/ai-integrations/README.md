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

## Knowledge ingestion

Attach a `KnowledgeConnectorAdapter` to the existing `ConnectorProviderConfig.knowledge` capability. The same registry exposes its input labels and supported content to the connector catalogue and Sources UI. Add provider behaviour in an adapter and register it beside the existing provider configuration; keep provider identifiers and pagination formats out of the shared source services, schemas and database constraints.

Implement root normalisation and validation, an initial checkpoint, document listing, permission evidence and version-safe content reads. Return normalised document IDs, titles, optional versions and citation URLs, with bounded opaque JSON checkpoints. Use a null version when the upstream provider cannot establish one; the shared worker then fetches content every scan instead of reusing a cached version.

Resolve owned connections through the API's existing connector account and stored API-key paths. Adapters receive the selected authentication mechanism when creating their reader. Composio adapters use `createKnowledgeProxyReader` with their own trusted origins, paths and read methods. The shared transport supports GET and explicitly scoped POST reads through the [proxy API](https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteProxy), bounds responses and rejects redirects. Drive declares GET only. Keep POST scopes limited to read/query endpoints and keep write operations outside this capability. Never pass model-selected endpoints or credentials into this boundary.

Keep credential ownership, personal/project scope, current workspace membership, publication authority, task leases, checkpoint commits and deletion reconciliation in the API. Normalise only verified upstream grants into public or individual-email evidence. Providers with group or organisation permissions must resolve their membership before those permissions can authorise a project audience.

The Drive adapter implements folder traversal, Google Docs exports and text files. It refuses incomplete scans, oversized content and versions that change during export. Adding another supported provider requires its adapter and registry entry, without changes to the API worker, source persistence or Sources form.

Read temporary text exports only from validated S3 or R2 URLs before they expire. Bound the download to 256 KiB, reject redirects and omit account credentials from the storage request.

Treat individual and public Drive grants as evidence of source access. Exclude expired, deleted and group-only grants; group membership needs its own verified resolver before it can authorise a project audience.
