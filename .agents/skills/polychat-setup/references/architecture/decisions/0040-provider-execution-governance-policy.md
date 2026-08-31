# ADR 0040: Resolve provider execution governance at the server boundary

## Status

Accepted. Extends [ADR 0017](0017-scope-capability-configuration.md) and complements
[ADR 0038](0038-provider-surface-model-lifecycle.md).

## Context

Polychat can send the same logical capability through different provider APIs, regions, connection
variants, and execution modes. Those paths do not have interchangeable data handling. A synchronous
request, background response, cached prompt, provider conversation, batch, file, vector store, or
hosted agent session may each use different processing locations, retention, provider storage, and
external state even when the provider and model are unchanged.

The current request contract exposes provider-shaped controls such as `store`, `background`,
`conversation`, and prompt-cache retention, while region and credentials are selected elsewhere.
There is no shared boundary proving that those values are compatible with an authenticated personal
or project policy before provider I/O. A stale or hostile client can therefore ask for a mode that is
less restrictive than the project intended, and a provider adapter can silently choose a convenient
API surface without explaining its governance consequences.

Current provider documentation confirms that no provider-wide safety label is truthful. OpenAI's
[data controls](https://developers.openai.com/api/docs/guides/your-data) describe endpoint-, region-,
model-, cache-, storage-, and background-specific combinations. Anthropic's
[API retention table](https://platform.claude.com/docs/en/build-with-claude/api-and-data-retention)
distinguishes stateless Messages requests from batches, files, hosted skills, code execution, and
managed sessions. Google Cloud's
[zero-data-retention guidance](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention)
separates request logging, grounding, Interactions storage, Live resumption, and in-memory caching.
These facts change independently and must be reviewed as operation profiles rather than inferred
from a provider name.

ADR 0017 already gives Polychat a scope-owned configuration seam, and ADR 0038 gives model execution
a server-owned provider-surface guard. Governance must deepen those seams rather than create a
client-owned provider selector, store credentials in capability configuration, or make each adapter
interpret project policy differently.

## Decision

### Policy, profile, and decision

Introduce three separate concepts:

- A **provider execution policy** is an authenticated personal or project constraint set. It says
  what the scope permits; it does not select a provider, connection, endpoint, model, or credential.
- A **provider operation profile** is code-owned metadata for one exact registered provider
  operation through one connection variant. It states what that candidate actually does.
- A **provider execution decision** is the server's result from intersecting platform constraints,
  the current scope policy, the target capability, an optional request tightening, and one compatible
  operation profile.

Store one dedicated, versioned policy record per scope. E0 owns a typed service adapter over
`capability_configuration`; route, provider, and UI code never construct its storage key. Reserve
`capability_kind: "provider_execution_policy"` and `capability_id: "default"` for this record and
reject any second record for the same scope. Extend only the repository's storage-key type with a
`ProviderGovernanceConfigurationKind` union containing that literal. Do not add it to
`AssistantCapabilityKind` or `ProjectCapabilityKind`: policy is not a product capability and must
never appear in capability discovery or attachment. Do not embed policy fragments in model-tool
settings or legacy `project_capability.configuration`: the scope policy must constrain every
provider-backed capability consistently. This is configuration only. Its presence does not enable a
personal capability, attach a project capability, grant provider access, or prove credentials exist.

For a project execution, intersect the platform baseline and current project policy. Do not import
the runner's personal policy. The runner's user-owned connection may be narrower or unavailable, but
it can never weaken project policy. For personal execution, use the authenticated user's policy. An
unauthenticated call can use only the platform baseline and a route's explicit public policy; it has
no saved policy scope. Compatibility remains capability-specific because the resolver evaluates the
scope policy against the exact requested operation profile, not because policy is copied into each
capability.

Represent the normalised constraint set in shared schemas. Authoring payloads may omit a field to
inherit it, but the resolver works only on a complete, versioned form:

```ts
type ProviderGovernanceOperationCategory = ProviderSurfaceCategory | "training";

type ProviderApiSurface = {
  provider: string; // canonical provider registration, never an alias
  operationCategory: ProviderGovernanceOperationCategory;
  api: string; // stable adapter-declared API family, not a URL
};

type ProviderRetentionClass = "zero_data" | "transient" | "bounded" | "standard" | "until_deleted";

type ProviderStorageClass = "none" | "memory" | "temporary" | "durable";
type ProviderCacheClass = "none" | "memory" | "persistent";

type ProviderExternalStateKind =
  | "response"
  | "conversation"
  | "batch"
  | "file"
  | "vector_store"
  | "provider_skill"
  | "agent_session"
  | "tool_session"
  | "generated_asset"
  | "training_job"
  | "custom_model"
  | "model_deployment";

type ProviderMaterialKind = "request_content" | "response_content" | ProviderExternalStateKind;

type ProviderDataHandlingComponent = {
  componentId: string; // stable within the code-owned profile
  material: ProviderMaterialKind;
  processingRegion: string;
  retentionClass: ProviderRetentionClass;
  maximumRetentionSeconds?: number;
  storageClass: ProviderStorageClass;
  maximumStorageSeconds?: number;
  cacheClass: ProviderCacheClass;
  maximumCacheSeconds?: number;
};

type ProviderExecutionConstraintSet = {
  version: 1;
  allowedApiSurfaces: ProviderApiSurface[];
  allowedProcessingRegions: string[];
  allowedRetentionClasses: ProviderRetentionClass[];
  maximumRetentionSeconds?: number;
  allowedStorageClasses: ProviderStorageClass[];
  maximumStorageSeconds?: number;
  allowedCacheClasses: ProviderCacheClass[];
  maximumCacheSeconds?: number;
  allowedExternalStateKinds: ProviderExternalStateKind[];
};
```

The governance operation category deliberately extends the provider registry's execution surfaces
with `training`. Training is not a model execution surface under [ADR 0038](0038-provider-surface-model-lifecycle.md),
but it is a direct provider operation that this policy must govern. E0 registers its profiles at the
training provider seam and keeps the mapping exhaustive as either vocabulary changes.

The shared processing-region vocabulary contains stable lowercase policy identifiers, not endpoint
hosts or credential locations. A provider connection variant maps its provider-native region onto
one of those identifiers through reviewed metadata. `global` is explicit and does not satisfy a
narrower regional requirement. Add a region or external-state kind through a shared schema change;
unknown free-form values never become execution authority. Training submissions name their
`training_job`, and any resulting `custom_model` or `model_deployment`, in addition to file state
used by the operation.

The retention classes describe customer-content handling for the operation, not every legal,
security, billing, or abuse-monitoring record a provider may retain. `zero_data` requires a reviewed
provider/account assurance for the exact operation. `transient` and `bounded` require a documented
upper bound. `standard` means the operation follows the provider's ordinary terms without an upper
bound Polychat can safely enforce. `until_deleted` is reserved for state whose lifecycle requires an
explicit delete or expiry. Storage and caching stay separate from retention: an operation can be
zero-data eligible while using isolated in-memory cache, and Polychat must not infer one dimension
from another.

A resolved operation profile contains one exact API surface and a non-empty set of data-handling
components. Each component describes one material input, output, cache, or external resource with its
own processing region, retention, storage, cache, and documented upper bounds. The profile must name
every material component the operation can create or use; use explicit `none` classes rather than
omitting a dimension. It also names the registered capability operation, compatible model or
modality constraints, connection-variant kind, profile version, source review date, review expiry,
and whether the account agreement or connection metadata has proved a conditional assurance such as
zero-data eligibility for each affected component. It contains no secret, raw endpoint, organisation
identifier, project identifier, token, or user data.

### Monotonic tightening

Define tightening mechanically rather than by provider-specific judgement:

- every request or capability allow-list is a subset of the inherited allow-list;
- every maximum duration is less than or equal to the inherited maximum;
- omission inherits the current value and never resets it to the platform default;
- an empty intersection is an incompatibility, not permission to choose another unreviewed mode;
- every component of the exact resolved operation profile must satisfy every resulting set and
  bound; one compatible component cannot mask an incompatible cache or external resource.

A request may therefore forbid storage, restrict execution to an already-allowed region or API
surface, reduce a cache or retention bound, or remove external-state kinds. It may not add a surface,
region, class, duration, or state kind. Provider-shaped legacy fields are translated into operation
requirements before this comparison. A restrictive legacy value remains accepted as a tightening;
a value that would widen or contradict the current policy is rejected with
`provider_policy_request_widening`. An adapter never receives an unchecked `store`, `background`,
`conversation`, cache, region, or external-state value.

Do not rank operation profiles by convenience and silently relax a requirement. Automatic provider
or model selection may choose among compatible profiles using its existing cost, quality, and
readiness policy only after governance filtering. An explicit provider or connection preference is
still subject to the same filter.

### Authority and resolution order

Resolve every provider execution in this order:

1. Authenticate the caller. Authorise the personal capability, or both current project membership
   and the project's effective capability through its existing attachment, default-capability,
   configuration, and role policy.
2. Resolve the exact capability target, registered provider operation, effective-capability revision,
   model lifecycle, and other existing compatibility facts without revealing inaccessible catalogue
   entries.
3. Read the one latest scope policy through the dedicated capability-configuration service.
4. Parse the optional request constraint and prove that it only tightens the saved policy.
5. Enumerate code-owned operation profiles and safe connection metadata; discard every incompatible
   profile.
6. Select one remaining profile through the existing provider/model policy, then load or refresh its
   credentials through the connection seam.
7. Revalidate personal or project capability authority, membership where applicable, effective-
   capability revision, policy revision, connection readiness, and the selected profile immediately
   before provider I/O.

Provider response data, client metadata, model output, saved task input, or an external resource
record cannot claim a policy assurance. A conditional assurance is true only when reviewed operation
metadata and current server-owned account/connection metadata both prove it. Missing, stale,
malformed, or contradictory facts fail closed.

Project policy changes require workspace `owner` or `admin` authority even when a member originally
attached the capability. Personal policy is owned by the authenticated user. Membership alone never
authorises an unattached, disabled, unconfigured, or otherwise unavailable project capability.
Saved agents, project tasks, schedules, retries, Realtime reconnects, and async continuations retain
their intended capability but re-enter current capability authority and policy before each new
provider invocation. A call already in flight may finish.

### External state and reverse operations

Creating or using provider state must name every external-state kind in the operation profile. A
scope that disallows that kind cannot start the operation. D3 owns journal identity, cleanup, and
exact-action persistence; this decision owns only whether a kind is compatible with execution.

Tightening policy does not remove the way out. Existing provider resources remain listable and may
be inspected sufficiently to identify and clean them up. Delete, revoke, cancellation, expiry, and
cleanup retries remain permitted through their exact existing authority even when new creation or
use is now forbidden. A stricter policy blocks new work with the resource; it never strands it by
blocking cleanup. Lost project membership still blocks person-initiated access, while the authorised
system cleanup path retains only the minimum opaque handle needed to finish deletion.

### Wire and service contract

Publish shared authoring, effective-policy, operation-disclosure, request-tightening, and
incompatibility schemas. Expose focused authenticated personal `GET`/`PUT` policy operations whose
scope comes only from the current user, and project `GET`/`PUT` policy operations below the existing
project route whose scope comes only from membership-authorised route state. Their body contains the
versioned policy, never `scope_type`, `scope_id`, `capability_kind`, or `capability_id`; callers cannot
name an arbitrary storage key. Tool and family-specific configuration routes do not mutate the scope
policy. `/capabilities` and focused setup responses may include the sanitised effective disclosure
for each operation before enablement or execution.

The disclosure contains the capability reference, whether the policy is compatible, and one stable
incompatibility reason when none are compatible. Once selection has occurred, it contains one
sanitised selected execution mode. Before selection, it contains a list of sanitised compatible
execution modes; never combine dimensions from different profiles into one apparent mode. Each mode
contains one API-surface label and a list of sanitised material components with their processing-
region label, retention class and bound, provider-storage class and bound, cache class and bound, and
external-state kind where applicable. It does not expose profile or connection identifiers, routing
scores or order, credential type, account or organisation identifiers, endpoint hostnames, project
numbers, agreement text, or secret presence beyond existing readiness.

Use one stable incompatibility shape:

```ts
type ProviderPolicyIncompatibility = {
  code:
    | "provider_policy_api_surface_incompatible"
    | "provider_policy_processing_region_incompatible"
    | "provider_policy_retention_incompatible"
    | "provider_policy_storage_incompatible"
    | "provider_policy_cache_incompatible"
    | "provider_policy_external_state_incompatible"
    | "provider_policy_request_widening"
    | "provider_policy_profile_unknown";
  field:
    | "apiSurface"
    | "processingRegion"
    | "retention"
    | "providerStorage"
    | "cache"
    | "externalState"
    | "request"
    | "profile";
  message: string;
  capability: { kind: string; id: string };
  operation: string;
  surface?: ProviderApiSurface;
  retryable: false;
};
```

Known incompatibility and request widening return HTTP 409 with the shared additive error envelope,
`type: "CONFLICT_ERROR"`, a top-level stable `code`, and
`details.providerPolicy: ProviderPolicyIncompatibility`. A trusted, already-authorised operation with
missing or internally inconsistent profile data returns a sanitised HTTP 503,
`type: "CONFIGURATION_ERROR"`, and `provider_policy_profile_unknown`. Authentication, membership,
credential, plan, lifecycle, and ordinary parameter failures retain their own status and code; do
not disguise them as governance failures. Keep `error` and `message` aliases during the rolling-client
window. The error may carry the same sanitised effective-policy disclosure as the setup response; it
never adds a raw connection candidate or hidden provider/account fact.

### Failure, retry, idempotency, and recovery

A governance denial is deterministic for one normalised policy, operation profile, connection fact
snapshot, and evaluation instant. It is terminal for that attempt and occurs before provider I/O, so
it creates no provider state and receives no provider retry. A queued execution, turn step, retry,
fallback, reconnect, or async submission re-enters the resolver with current authority and policy.

Never fall back from a failed or unavailable profile to one that violates policy. A retry may choose
another compatible profile only when the operation's existing idempotency boundary permits it and no
external state may have been created. Once an operation has an external identifier, status, result,
cancellation, and cleanup remain bound to that exact profile and connection rather than being routed
to another provider.

Persist the policy digest, profile ID and version, decision code, and external-state kinds with a
durable execution or journal record. Do not persist the full request or secrets for this purpose. If
the current policy later rejects new use, historical status and cleanup remain truthful; do not
rewrite the original decision.

### Performance and caching

Provider operation profiles are immutable code-owned metadata for a deployed version and may be
indexed in memory by capability, provider surface, operation, and profile ID. Normalised effective
constraints, including request tightening, have a canonical digest. Key a compatibility result by
that digest, capability and operation identity, profile ID and version, model lifecycle identity and
snapshot, and a unique digest of the safe connection-governance facts used for the decision. The
connection-facts digest includes every account- or agreement-conditional assurance; a version number
alone is not an identity, and cached assurance is never shared between connections or accounts.

Mutable scope policy is not a Worker-isolate authority cache. Read it at each new provider invocation,
including later turn steps, queued work, retries, Realtime reconnects, and async submissions. One
invocation may reuse the resolved decision while constructing and issuing its single provider call;
the next invocation resolves again. Configuration and connection mutations invalidate API and client
disclosure caches. A cache TTL must not outlive any policy duration, credential expiry, model
lifecycle deadline, or provider-profile review expiry.

### Security, audit, and observability

Validate and normalise policy at the authenticated configuration boundary. Reauthorise the scope on
every read and write. Save a project policy mutation and its workspace audit record atomically. The
record contains changed policy fields, old and new policy digests, actor, and timestamp, but not raw
configuration, credentials, or provider identifiers that the actor is not allowed to see. Personal
changes emit the existing authenticated configuration event pattern without manufacturing a
workspace audit record. Ordinary execution decisions belong in operational telemetry rather than an
immutable workspace audit row; creation, deletion, or revocation of governed external state still
uses its owning audit seam.

For each decision, record request or execution ID, path, scope type, capability kind and ID, provider
registration, surface category, API-surface ID, policy and effective-constraint digests, profile
ID/version, sanitised component class summaries, external-state kinds, allow or deny outcome, and
stable reason code. Count request-widening attempts, incompatibilities by field, missing profiles,
profile review expiry, and fallback candidates removed by policy. Trace the policy decision before
provider latency so operators can distinguish local denial from provider failure.

Never log prompts, response bodies, file names or contents, provider errors before sanitisation,
credentials, tokens, connection account identifiers, raw endpoints, external resource IDs, or the
full policy document. Provider errors cannot update a profile or teach the resolver that an unsafe
combination is supported.

### Migration and rolling clients

Roll the boundary out additively:

1. Add shared schemas, the dedicated scope-policy service over capability configuration, canonical
   normalisation/digest, incompatibility contract, and resolver. A missing saved policy derives the
   explicit platform baseline; malformed stored policy fails closed and is counted.
2. Register reviewed operation profiles at the existing provider registration or capability seam.
   Keep profile metadata beside the operation that owns it, not in clients or a second provider
   catalogue. CI proves every enforced path has complete, unexpired profile facts.
3. Put provider preflight immediately before I/O in the shared execution seams. An operation enters
   an enforced seam only with a reviewed profile. Where historical behaviour must be represented
   before a precise reconciliation, register an explicit conservative legacy profile for that exact
   operation with an owner, source note, review expiry, and CI coverage. Unknown or expired profiles
   always fail closed; there is no execution-time baseline bypass.
4. Translate existing `store`, `background`, `conversation`, prompt-cache, region, and similar request
   fields into typed operation requirements. Preserve restrictive fields for old API clients, but
   reject any widening or contradiction with the same 409 contract used for new clients. Replace
   today's implicit `store: true` and provider-cache defaults with profile-derived values at that
   boundary. New clients send the shared tightening contract.
5. Ship web and iOS disclosure/configuration consumers. Old clients continue to receive the fallback
   `message` and cannot widen server policy; they may omit new policy fields safely.
6. Add regional and identity connection variants behind the connection seam. Their credentials,
   project/location identifiers, endpoint construction, and refresh state never enter
   `capability_configuration`.
7. Replace each conservative legacy profile with reviewed precise metadata only after its invocation
   path has a complete profile and bypass test. Remove legacy provider-shaped request fields only
   through a separately versioned API change.

The policy JSON fits the existing configuration column, so this decision does not require a database
migration. Existing capability configuration remains valid and gains the platform baseline until a
person or project administrator saves an explicit policy.

Do not copy effective policy into saved agents, project tasks, recipes, schedules, or client settings.
They retain capability intent and re-resolve the one current scope policy at execution. Durable
execution evidence may preserve only the policy digest and selected profile facts described above.

### Non-chat deployables

The preflight requirement covers every direct provider consumer, not only the chat turn engine.
Realtime session creation and reconnection, audio, speech, transcription, image, video, music,
embedding, search, research, guardrails, OCR, memory, messaging, sandbox-mediated provider work, and
training submission must resolve an operation profile before their first provider call and again
before later calls.

The API remains the authority for personal/project configuration. A Worker without direct access to
that state, including the training or sandbox Worker, may begin new provider I/O only with an
integrity-protected, API-issued internal grant. The opaque or signed grant is short-lived and bound to
one Worker audience, one invocation ID, one scope, the authorised effective-capability revision,
operation, profile, policy and effective-constraint digests, issued-at and expiry times, and a unique
nonce. The receiving Worker authenticates the API issuer and its own audience, verifies every bound
fact, and atomically consumes the nonce immediately before I/O so the grant cannot be replayed. Do not
log or expose the grant. A retry, later provider call, continuation, or new resource creation obtains
a fresh grant after API reauthorisation; a queued task or service binding is never authority. Status
and cleanup of an already-bound operation keep the exact original profile and minimum cleanup
authority without reusing its creation grant.

## Consequences

Polychat gains one explainable server boundary for provider governance without treating a provider,
model, endpoint, or credential as inherently compliant. Personal and project policy share a contract,
while project authority remains independent from the runner's personal connection. Clients can show
what will happen before enablement, but they cannot manufacture assurance or relax saved policy.

The stricter contract makes provider integration more deliberate. Every executable operation needs
reviewed profile metadata, duration bounds must be defensible, and provider documentation changes can
make a previously compatible capability unavailable until reconciled. That maintenance cost is the
price of making retention, residency, storage, cache, and external state truthful.

## Rejected alternatives

- **Label an entire provider or model as compliant.** Provider facts vary by endpoint, feature,
  region, model, account agreement, and execution mode.
- **Let clients choose governance parameters directly.** A stale or hostile client could loosen
  project policy, and rolling clients would disagree about provider compatibility.
- **Store credentials, endpoints, projects, or regions as policy configuration.** Those values belong
  to revocable connection variants and may contain secrets or authority; policy only constrains them.
- **Let adapters interpret policy independently.** Direct chat, agents, tasks, Realtime, async work,
  sandbox and training paths would drift and preserve bypasses.
- **Infer zero-data behaviour from `store: false` or cache type.** Provider storage, cache, retention,
  abuse monitoring, and external resources are independent dimensions.
- **Silently choose a less restrictive-looking provider after incompatibility.** Without an exact
  compatible profile this is an authority change, not recovery.
- **Snapshot project policy for the lifetime of a long turn or task.** A later provider step could
  execute after an administrator tightened governance or removed membership.
- **Block deletion when creation becomes forbidden.** That strands external data and turns a safer
  policy change into a cleanup failure.
- **Create a separate governance table immediately.** The existing scope-capability configuration
  seam already owns validated runtime settings; a second persistence model adds no current leverage.
