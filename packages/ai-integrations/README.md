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

## Native MCP protocol

Use `McpProtocolClient` for the [2026-07-28 MCP protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http). Supply a host-owned `McpRequestSender` and cancellation signal. The sender must check the current endpoint consent, connection revision and user/project authority before sending each request; this package owns no endpoint, credentials, background connections or HTTP fetches.

```ts
import { McpProtocolClient } from "@ngriffin_uk/polychat-ai-integrations";

const client = new McpProtocolClient(sendAuthorisedRequest, runAbortSignal);
const catalogue = await client.discoverTools();
```

Discover tools through `server/discover` and bounded `tools/list` pagination. Newly discovered tools remain disabled for curator review. Hash the tool name, description and input/output schemas with `getNativeMcpToolSchemaDigest`; classify access in Polychat's catalogue, independently of server annotations or instructions.

Validate arguments without inserting schema defaults or changing approved values. Validate successful structured results against the output schema. Support JSON and request-scoped SSE, with a 64 KiB request limit, 512 KiB response limit and 30-second whole-request deadline. Send each tool call once and cancel its response stream on interruption; an uncertain write requires the host's existing approval/replay machinery.

Require modern per-request metadata, matching routing headers and `resultType: "complete"`. Encode mirrored Unicode or control-character header values using the protocol's Base64 sentinel. Exclude tools with invalid header annotations or unsupported schemas rather than weakening validation.

Accept bounded JSON Schema 2020-12 with finite local references, primitive enums/constants and simple anchored patterns. Require explicit types for validation rules and defined, non-optional schemas for required properties. Reject recursive/external/dynamic references, conditional schemas, pattern properties and other features unsupported by the installed validator. Do not request sampling, elicitation, roots, subscriptions or legacy sessions.

The API integrates this client with its private catalogue, endpoint-bound personal credentials, explicit project sharing and existing stored-action approval. Select registered server IDs in account capabilities and teammates. Provider-hosted MCP definitions are rejected. Tool results remain untrusted service output and never trigger automatic resource downloads or repeated writes.
