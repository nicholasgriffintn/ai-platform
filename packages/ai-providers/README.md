# @ngriffin_uk/polychat-ai-providers

Provider primitives for Polychat backends, including every provider implementation: chat, decision, reranking, image, audio, speech, transcription, video, music, OCR, realtime, search, research, and guardrails. A host supplies a `ProviderHost` (model resolution, storage, key store, metrics) and gets a `ProviderLibrary` that bootstraps each category lazily, resolves by name or alias, handles lifecycles, and maps errors. The package does not know about Cloudflare, D1, or a specific host's error type.

```ts
import { createProviderLibrary } from "@ngriffin_uk/polychat-ai-providers";

const library = createProviderLibrary({
  host,
  bootstrappers: { chat: [registerSandboxProvider] },
  decorators: { chat: [withAvailableFunctions] },
  mapError: (error) => new HostError(error.message, error.code),
});

const openai = library.resolve("chat", "OAI", { env, user });
library.listNames("chat", { includeAliases: true });
```

`createAiProviderBootstrappers(runtime)` registers the built-in providers, and `createProviderLibrary` merges the host's own bootstrappers on top. Providers receive a `ProviderRuntime` (`host` plus a resolver for sibling providers), so a provider that needs another category asks the runtime rather than importing it.

## Host

`ProviderHost` is the inversion point. `models` resolves model configuration, `storage` creates output stores, `keyStore(env)` reads user credentials, `metrics` records provider operations, and `realtime.createProxyGrant` mints realtime proxy grants. The API implements it once in `apps/api/src/lib/providers/host.ts`.

## Library

`ProviderLibrary` runs a category's bootstrappers the first time that category is touched, and each bootstrapper at most once, so a bootstrapper added later through `registerBootstrapper` extends the category without re-registering what is already there. `list()` with no category bootstraps every category it knows about. Registrations default to `singleton`; a `transient` registration creates a new instance per resolve, which is the right choice when the instance captures request-scoped context.

`decorate` sees every resolved instance and may wrap it, which is where metering or tracing belongs. `mapError` receives each `ProviderError` the library would otherwise throw and returns the host's own error type, so callers never see the package's wording unless the host chooses it.

## Errors

Failures throw `ProviderError` with a `code`:

- `duplicate_registration`, `unknown_category`, `unknown_provider` from the registry
- `credential_required` when BYOK authority was demanded and the user holds no key
- `credential_unavailable` when a stored user key could not be read back
- `credential_missing` when the platform key is absent from the environment

## Credentials

`resolveProviderApiKey` prefers a user's stored key, read through the host's `ProviderKeyStore`, and falls back to the platform key named by `envKeyName`, unless `credentialAuthority` is `"byok"`. `isProviderPlatformEnabled` and `getPlatformEnabledProviders` answer whether the platform holds credentials for a provider id, using `PROVIDER_PLATFORM_ENV_KEYS`, where each provider lists alternative groups of environment keys that must all be present.

## Bedrock Managed Agents

Bedrock Managed Agents owns a stateful agent loop and executes tools in your AWS AgentCore Runtime. Use `BedrockManagedAgentsClient` for this session API. Configure ordinary model inference through the existing Bedrock providers.

```ts
import { BedrockManagedAgentsClient } from "@ngriffin_uk/polychat-ai-providers";

const client = new BedrockManagedAgentsClient({
  region: "us-east-1",
  credentials: async () => ({
    accessKey: await secrets.read("accessKeyId"),
    secretKey: await secrets.read("secretAccessKey"),
    sessionToken: await secrets.readOptional("sessionToken"),
  }),
});

const session = await client.createSession({
  agent: { model: "openai.gpt-5.6-luna", instructions: "Inspect the workspace." },
  environment: {
    type: "aws_bedrock_agentcore",
    runtime_arn: "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/example-runtime",
    runtime_qualifier: "DEFAULT",
    workspace_directory: "/home/app/workspace",
    capability_directories: ["/opt/bma/plugins"],
  },
  role_arn: "arn:aws:iam::123456789012:role/BmaSession",
});

const controller = new AbortController();
const events = await client.streamEvents(session.id, controller.signal);
await client.sendMessage(session.id, "Summarise the files in this workspace.");
```

Open the event stream before submitting work, then consume its SSE frames. Use `listItems` with `last_id` as the next `after` cursor to reconcile durable output after a disconnect. Use `retrieveSession`, `listSessions`, `cancelTurn` and `deleteSession` for the rest of the lifecycle. A successful message or cancellation request acknowledges acceptance. Inspect terminal events and command exit codes to determine the outcome.

**Prepare AWS first.** Deploy a compatible Codex exec server in an AgentCore Runtime, enable a supported OpenAI model, and create a same-account session role. The supported preview regions are `us-east-1`, `us-east-2` and `us-west-2`. The endpoint region follows the Runtime ARN. The integration never provisions runtimes or changes IAM policies.

Grant the caller `bedrock-mantle:CreateAgentSession`, `GetAgentSession`, `ListAgentSessions`, `CreateAgentSessionEvent`, `ListAgentSessionEvents`, `ListAgentSessionItems` and `DeleteAgentSession`, plus `iam:PassRole` restricted to the session role and `iam:PassedToService = bedrock-mantle.amazonaws.com`. Configure that role's trust for `bedrock-mantle.amazonaws.com` with your source account and ARN conditions. Grant it `bedrock-mantle:CreateInference` constrained to your model, and `bedrock-agentcore:InvokeAgentRuntime` and `StopRuntimeSession` scoped to your Runtime and endpoint. Give the Runtime its separate execution role with narrowly scoped registration, connection and tool permissions.

Follow the [AWS AgentCore setup guide](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-bma.html), [preview REST reference](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-managed-agents-openai-api-reference.html) and [IAM guide](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-managed-agents-openai-security.html). The preview can change independently of the OpenAI-hosted Agents API. This adapter uses documented text messages, SSE and items; it does not assume hosted sandbox setup commands, an artifact-download API, subagents or approval callbacks.

### Polychat API and credentials

Use the authenticated `/apps/managed-agents/sessions` endpoints through the typed helpers exported by `@ngriffin_uk/polychat-library-client`. Call `createBedrockManagedAgentSession(configuration, projectId?)`, then address every later operation by the returned **Polychat session `id`**. Keep the upstream `sessionId` for diagnostics. Polychat only exposes sessions it created and recorded.

| Method | Path suffix                                       | Behaviour                                                       |
| ------ | ------------------------------------------------- | --------------------------------------------------------------- |
| POST   | `/sessions?projectId=…`                           | Create a project session; omit the query for a personal session |
| GET    | `/sessions?projectId=…&limit=20&offset=0`         | List stored sessions in the chosen scope                        |
| GET    | `/sessions/:id`                                   | Refresh remote state                                            |
| POST   | `/sessions/:id/messages`                          | Submit `{ "text": "…" }`                                        |
| POST   | `/sessions/:id/cancel`                            | Request turn cancellation                                       |
| GET    | `/sessions/:id/events`                            | Stream progress with an abort signal                            |
| GET    | `/sessions/:id/items?limit=100&order=asc&after=…` | Read paginated durable output                                   |
| DELETE | `/sessions/:id`                                   | Delete the session and mark its binding deleted                 |

**Personal sessions** use the user's encrypted `bedrock` provider credential in the existing `accessKey::@@::secretKey` format. The reusable parser also accepts a third `::@@::sessionToken` segment for temporary credentials. The existing account form saves the two-key format. Store temporary credentials through the provider-settings API when needed.

**Project sessions** use the project's workspace AWS connection under **Models → Governance**, including its optional session token. They never fall back to the caller's personal keys or platform keys. Workspace members can read project sessions. Owners and admins can create sessions, submit work, cancel or delete them. Personal sessions remain accessible only to their creator. Every request rechecks scope and reads the current encrypted credentials, so removal, rotation and role changes apply to subsequent requests.

Session bindings live in the existing activity store and retain only ownership, model, role, Runtime configuration and remote session ID. Instructions, message text, outputs and AWS secrets are not copied into activity or audit records. Project actions produce audit events containing the local ID and action. Requests use SigV4 for `bedrock-mantle`, reject redirects, bound JSON responses and use a 30-second timeout for finite operations. Event streams remain open until disconnected or explicitly aborted; page limits bound each items read.

**Handle ambiguous writes explicitly.** Creation and input submission are not retried automatically. A creation failure leaves a failed local activity; if AWS accepted the request before a network failure, inspect `listSessions` directly with the reusable client before creating another session. If recording a known remote session fails, Polychat attempts to delete it. A failed cleanup logs the remote session ID for operator recovery. Refresh sessions to reconcile remote status; `idle` maps to waiting and does not imply task success.

Deleting is idempotent for an already missing remote session. A conflict remains an error so you can inspect and cancel active work before retrying. Cancellation and deletion do not undo completed tool actions or remove customer-managed Runtime definitions, stacks or stored files. AWS bills model inference and Runtime resources directly to the credential owner. Validate against your own preview-enabled account before production use; local tests mock the AWS service.

## Fallback

`generateWithProviderFallback` calls the requested provider and, when no model was pinned and fallback is allowed, retries once on the default provider.

## Decisions

The `decision` category wraps System One models: a `DecisionProvider` takes a `state` and a map of typed questions (`choice`, `score`, `noul`) from `@ngriffin_uk/polychat-schemas` and returns calibrated answers, never text. TypeSafe's Jev is the first implementation (`typesafe`, aliases `typesafe-ai` and `jev`), authenticated with `TYPESAFE_API_KEY` or a user's stored key; `TYPESAFE_BASE_URL` overrides the endpoint. Questions in one request are independent and run in parallel, so ask everything that might matter in one call. `ProviderHost.models.getAuxiliaryDecisionModel` tells the package whether a decision model is available for the account. The `typesafe` guardrails provider is built on it and screens with four hazard nouls plus a severity score.

## Reranking

The `reranking` category gives retrieval callers one provider-neutral Interface for ordering documents against a query. Requests carry opaque document ids and text; responses return the same ids with relevance scores. The shared schemas and provider adapters reject incomplete, duplicate or foreign results before they reach callers.

Built-in Adapters cover Cloudflare Workers AI and Cohere. `ProviderHost.models.resolveRerankingModel` centrally resolves either the default lineup candidate or an explicitly selected accessible reranking model. It rejects models outside the reranking output modality before provider resolution. The provider capability only produces a ranking—combining it with an earlier retrieval score or retaining a baseline order is caller policy.
