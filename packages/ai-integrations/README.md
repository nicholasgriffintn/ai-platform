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

Use `listDriveKnowledgePage`, `getDriveKnowledgePermissions` and `readDriveKnowledgeContent` to index selected Drive folders through an existing connected account. Resume folder traversal from the stored checkpoint, export Google Docs as text and include text files. Refuse incomplete scans, oversized content and versions that change during export.

Keep account ownership, project publication, checkpoints and deletion reconciliation in the API's sources module. The fixed Drive reader sends only authenticated GET requests through Composio's [proxy API](https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteProxy), with bounded responses and redirects rejected. It exposes no general proxy tool to a model.

Read temporary text exports only from validated S3 or R2 URLs before they expire. Bound the download to 256 KiB, reject redirects and omit account credentials from the storage request.

Treat individual and public Drive grants as evidence of source access. Exclude expired, deleted and group-only grants; group membership needs its own verified resolver before it can authorise a project audience.
