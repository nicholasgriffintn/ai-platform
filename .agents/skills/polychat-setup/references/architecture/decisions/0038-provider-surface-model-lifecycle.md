# ADR 0038: Scope model lifecycle to a provider surface

## Status

Accepted. Extends [ADR 0030](0030-server-owned-model-selection-policy.md) and
[ADR 0031](0031-registry-owned-realtime-provider-catalogue.md).

## Context

ADR 0030 made the server responsible for executable-model policy, but the catalogue still reduces
lifecycle to `deprecated` and `status: deprecated`. That cannot distinguish a model that is nearing
retirement from one that has already stopped serving requests, or an intentionally descriptive
record from an executable one. It also treats a model family as though it has one lifecycle even
when Google AI Studio, Vertex, Bedrock, Azure OpenAI, OpenRouter, and a first-party API retire their
serving surfaces independently.

The ambiguity reaches every execution path. A direct model ID, saved agent, queued project task,
persisted client selection, auxiliary model reference, or Realtime session can outlive the catalogue
state under which it was chosen. Removing an identifier loses historical display; silently replacing
it changes cost, behaviour, data location, credentials, and capability support. Clients also roll out
behind the API, so a new lifecycle field cannot itself be the enforcement boundary.

## Decision

### Identity and states

Treat lifecycle as policy for one `(surface, modelId)` pair. `surface` is the existing provider-registry
key: the canonical provider registration name plus capability category. Registration aliases are
normalised at the request boundary and never stored in lifecycle, replacement, history, or notice
data. The key distinguishes, for example, `(openai, chat)` from `(openai, realtime)` and
`(google-ai-studio, chat)` from `(google-vertex, chat)` without inventing a second provider registry.
It is not the model maker, family, connection variant, region, or credential. If one provider and
capability later register two independently-lived APIs, the registry must give them distinct
canonical registrations rather than adding a free-form lifecycle suffix.

Move the API registry's category values into `packages/schemas` as
`providerSurfaceCategorySchema` and infer the shared `ProviderSurfaceCategory` type from it. This is
the narrower registry-backed serving vocabulary, not the broader product-level provider capability
vocabulary: it contains only categories present in `CategoryProviderMap`. The API registry imports
that schema/type and makes its current `ProviderCategory` an alias during migration; it does not keep
a second union. The registry still owns which canonical provider names and aliases are registered.
A training job is not a model execution surface; a deployed trained model uses the registered surface
that serves it, such as chat. Add `training` only if a future provider adapter registers that category.

`modelId` is the required, immutable Polychat catalogue `id`; the provider's remote model name remains
`matchingModel` and is never durable identity. Provider catalogue declarations own explicit stable
keys, normalisation copies that key into required wire field `id`, and the normalised `ModelConfig`
map key must equal `id`. Merge rejects duplicate IDs instead of creating provider prefixes or
order-dependent numeric suffixes. A model served through two registry surfaces has two independently
reviewed lifecycle records even when both records name the same provider, maker, family, or remote
model.

Publish an additive `lifecycles` collection on each model record:

```ts
type ModelProviderSurface = {
  provider: string;
  capability: ProviderSurfaceCategory;
};

type ModelLifecycle = {
  surface: ModelProviderSurface;
  state: "active" | "deprecated" | "retired" | "catalogue_only";
  replacement?: {
    surface: ModelProviderSurface;
    modelId: string;
  };
  executionEndsAt?: string; // RFC 3339 instant
};

type ModelLifecycles = ModelLifecycle[];
```

The states mean:

- `active`: the provider surface accepts new executions and Polychat may select or execute the model,
  subject to adapter, account, credential, scope, modality, and capability policy.
- `deprecated`: the provider surface still accepts executions but has announced migration or
  retirement. Polychat may execute an explicit selection before `executionEndsAt`, but never chooses
  it as an automatic default, router candidate, auxiliary policy reference, or new Realtime default.
- `retired`: the provider surface no longer accepts new executions. Keep the record for history, but
  never select, resume, retry, reconnect, or execute it.
- `catalogue_only`: Polychat intentionally retains or advertises descriptive model metadata without
  claiming executable support on this provider surface. It is never selectable or executable. Use a
  provider lifecycle state instead when deprecation or retirement is known.

`active` and `catalogue_only` records have no `executionEndsAt`. A `deprecated` record may omit the
deadline only when the provider has not published one. A retired record preserves the last known
deadline for history. At or after a deprecated record's `executionEndsAt`, the server treats it as
non-executable even if catalogue reconciliation has not yet changed the stored state to `retired`.

A replacement is guidance, not routing authority. It may cross providers but keeps the same
capability category and must resolve to a different catalogue surface/model pair whose lifecycle is
`active` at review time. Account access and credentials are still evaluated separately, so the
server and clients never follow a replacement silently. Omit a replacement rather than naming an
uncertain or inaccessible target.

### Data invariants

- One model has at most one lifecycle entry for each registry surface. A lifecycle surface's provider
  equals the model entry's `provider`; changing the model ID or surface creates a new identity rather
  than rewriting durable history.
- Every normalised model has one required canonical `id`, and its `ModelConfig` key is identical.
  Duplicate canonical IDs fail catalogue construction and CI. `matchingModel`, display name, source
  order, provider aliases, and merge position never create or change identity.
- Every model entering the guard resolves exactly one schema-valid lifecycle for the requested
  surface. Reconciled checked-in records are explicit; unreconciled trusted records use the legacy
  derivation below; server-owned dynamic models synthesise lifecycle from their authorised resource
  state. Dates are valid RFC 3339 instants and state/date combinations follow the rules above.
- A replacement is not self-referential, preserves the capability category, resolves to an existing
  active surface/model pair, and cannot make that target executable for an account that otherwise
  lacks access.
- `isDefault: true` implies active lifecycle and `isExecutable: true`. `isExecutable: true` implies
  either active lifecycle or an explicitly executable deprecated lifecycle before its deadline, plus
  every existing access and adapter check.
- Retired, catalogue-only, deadline-passed, missing, and malformed lifecycle records are never sent
  to a provider. Central policy references resolve only to explicit active records.
- Durable execution history retains the provider surface and model ID it actually used. A lifecycle
  notice records the same evaluated pair and state as its guard decision.

### Selection and execution

Deepen ADR 0030's model-policy seam with one lifecycle guard. Do not add another selector or let
provider adapters interpret lifecycle independently. First resolve the requested ID or unique remote
name and canonical provider alias through the existing visibility and access boundary. An unresolved,
ambiguous, inaccessible, or provider-mismatched client reference keeps the existing generic
parameter/access denial and does not produce a lifecycle notice or configuration alert. This avoids
turning arbitrary input into a server-health signal or disclosing catalogue existence.

For the resolved trusted record, the guard resolves the exact canonical registry surface, evaluates
the effective lifecycle instant, then applies the remaining credential, scope, modality, adapter, and
capability checks. Every provider call must receive a model that has passed that seam. A known record
whose expected lifecycle entry is missing or malformed is an internal lifecycle inconsistency and
fails closed with `model_lifecycle_unknown`. Adapter registration and model compatibility remain
separate prerequisites; lifecycle filters them and never manufactures support.

ADR 0030's automatic and central policy references remain active-only. This decision narrowly
supersedes its blanket ban on deprecated execution: a caller may explicitly execute a deprecated
model before its deadline and receives a warning on every attempt. Explicit model IDs never bypass
the guard. External lifecycle data is validated at reconciliation or dynamic-resource ingestion and
never becomes execution authority directly.

Revalidate immediately before each provider invocation, including later steps in the shared turn
engine, retries, queued work, agent completions, project-task runs, auxiliary work, Realtime session
creation, and Realtime reconnect or token refresh. A provider call already in flight may finish; a
subsequent call must pass the current guard again.

Persisted picker and local-setting state is convenience, not authority. Web and iOS repair a retired,
catalogue-only, inaccessible, or unknown remote selection through the server-published default or
automatic routing. A browser-only local runtime remains outside remote provider lifecycle and cannot
use local settings to advertise or invoke a remote model. Durable intent is different: saved agents,
project tasks, flows, schedules, and API requests retain their configured model for inspection and do
not mutate to a replacement. Their next run either uses the still-valid deprecated model with a
warning or stops with the lifecycle error and replacement guidance. A saved configuration with no
explicit model continues to resolve through the active server default.

Realtime discovery may present a deprecated option with its warning and deadline, but retired and
catalogue-only records are unavailable. Session creation remains the authority under ADR 0031. An
established bounded session may finish after a lifecycle change; creating, resuming, reconnecting, or
refreshing authority for a session is a new execution and must revalidate.

### Wire contract and failure shape

Keep `isExecutable` as the account-specific answer for the surface declared by the containing API and
`isDefault` as that surface's server-selected active default. `/models` projects the chat surface;
Realtime and capability-specific catalogues project their own registered surfaces. Lifecycle explains
why a model is changing; it does not replace entitlement, readiness, compatibility, or
registered-adapter facts. Publish the relevant `lifecycles` wherever model data crosses the shared
API, web, iOS, Realtime, sandbox, or training contract. A raw catalogue record has no global
executable truth across all surfaces.

Use one shared lifecycle notice shape for catalogue guidance, successful deprecation warnings, and
lifecycle failures:

```ts
type ModelLifecycleNotice = {
  code:
    | "model_deprecated"
    | "model_retired"
    | "model_catalogue_only"
    | "model_deprecation_deadline_passed"
    | "model_lifecycle_unknown";
  severity: "warning" | "error";
  surface: ModelProviderSurface;
  modelId: string;
  lifecycleState: ModelLifecycle["state"] | "unknown";
  evaluatedAt: string; // RFC 3339 instant
  message: string;
  replacement?: ModelLifecycle["replacement"];
  executionEndsAt?: string;
};
```

The code and structured fields are stable; `message` is a user-facing fallback and may be refined.
A successful deprecated execution carries `warnings: ModelLifecycleNotice[]` in transport-neutral
response metadata. Streaming emits a `model_lifecycle_notice` event containing the same notice before
provider output, and its terminal stored message keeps the warning. Realtime session creation also
returns `warnings`. Reloads, shared history, and task evidence therefore do not lose the decision.

Lifecycle refusal extends the shared error response with one canonical additive shape:

```ts
type ModelLifecycleErrorResponse = {
  error: string;
  message: string; // rolling-client alias of error
  type: "CONFLICT_ERROR" | "CONFIGURATION_ERROR";
  statusCode: 409 | 503;
  code: ModelLifecycleNotice["code"];
  details: { lifecycle: ModelLifecycleNotice };
};
```

The lifecycle paths use this shared contract even while older generic routes still return divergent
error envelopes. Retired, catalogue-only, and deadline-passed requests use `CONFLICT_ERROR` and HTTP
409 because the once-addressable execution target conflicts with current policy. An internally
inconsistent lifecycle on an already resolved trusted record uses `CONFIGURATION_ERROR` and a
sanitised HTTP 503 with `model_lifecycle_unknown`; it is not blamed on the caller and never exposes
catalogue internals. An unknown, ambiguous, inaccessible, or provider-mismatched client model
reference returns the existing generic parameter/access response instead. The duplicated `message`
lets old web and iOS clients show the fallback and is removed only with a versioned error-contract
change. Account or credential denial keeps its existing status and must not be disguised as lifecycle
failure.

### History and migration

Never delete a retired catalogue identifier while retained messages, conversations, outputs, agents,
tasks, traces, or audit records may reference it. New execution history stores the surface and model
it actually used. Legacy messages that stored only a model ID use best-effort historical resolution
and show an unknown surface when ambiguous; do not fabricate or rewrite their provenance. Historical
reads may add current lifecycle guidance, but do not imply that replay is possible. Replacement data
is advisory and historical content is never rewritten.

Roll the change out additively:

- Snapshot every currently published merged model key and make it that record's explicit canonical
  ID before changing merge behaviour. Preserve provider-qualified and numeric-suffixed keys exactly
  when durable references may already use them; awkward existing identity is safer than reassignment.
  Normalisation then requires `id`, makes the map key equal it, and fails duplicate IDs. Unique
  `matchingModel` lookup remains a request convenience, but all new history, replacements, saved
  configuration, and notices write the canonical ID returned by resolution.
- Introduce the shared lifecycle and notice schemas, the central guard, and server-side derivation
  first. A trusted checked-in catalogue record with no lifecycle derives `deprecated` from the legacy
  flags and `active` otherwise only for the exact requested surface where an existing registered
  adapter already declares that model compatible. Count every derivation, identify its provider, and
  remove this fallback per provider when that provider's records are reconciled. Do not infer another
  surface or manufacture adapter support. Missing or malformed lifecycle from a request or external
  source never receives that fallback.
- Require server-owned dynamic model sources, including user-authorised training deployments, to
  synthesise lifecycle at the model-service boundary from their current resource/deployment state and
  registered surface. Their canonical IDs derive from an immutable local resource identity, are not
  recycled, and preserve any already-published dynamic ID during migration. A missing, stopped,
  deleted, or unauthorised resource is non-executable. Never accept lifecycle state from the client or
  copy provider response data into the public contract.
- Reconcile the first-party Anthropic, Google AI Studio, Google Vertex, and OpenAI catalogue records by
  provider surface and make their lifecycle explicit. Convert each central default and policy
  reference only after its target is explicitly active. Other providers retain the observable trusted
  derivation until an owning reconciliation task makes them explicit.
- Ship web and iOS consumers, then remove each reconciled provider's trusted missing-field fallback.
- Derive legacy `deprecated`, `status: deprecated`, `deprecationMessage`, and `replacementModel`
  fields during the supported rolling-client window. Old clients may conservatively hide a
  deprecated model; they must still see `isExecutable: false` for every non-executable state. Remove
  legacy fields only in a separately versioned contract change after the oldest supported clients no
  longer depend on them.

No database migration is required for checked-in catalogue metadata or existing dynamic deployment
state. Durable saved objects keep their model ID; execution-time revalidation supplies the migration
boundary.

### Failure, retry, and recovery

The lifecycle guard is deterministic and side-effect free for one catalogue snapshot and evaluation
instant. A denial is terminal for that attempt and occurs before provider I/O, so it creates no
provider cleanup or compensating action. Provider and turn retries re-enter the guard with the current
catalogue and time; retry policy cannot extend a deadline. Deduplicate a persisted deprecation notice
by execution and notice code so transport retries do not create repeated historical warnings.

Do not retry unknown or internally inconsistent lifecycle state as a provider failure. Record the
configuration fault and let the normal catalogue or deployment repair restore service. Client picker
recovery uses the server default; saved agents and tasks remain blocked with structured remediation
until a person changes the durable model or catalogue policy makes it executable again.

### Performance and cache behaviour

Resolve lifecycle from the same in-process catalogue snapshot used by model policy. Index by provider
surface and model ID so the guard is constant-time and adds no provider or database round trip per
invocation. Account-specific catalogue caching may cache the derived `isExecutable` result only for
the existing bounded model-cache lifetime and must invalidate with provider configuration or
catalogue changes. Never cache past `executionEndsAt`; cap expiry at the deadline so a warm Worker or
client cannot extend deprecated execution.

### Operations and security

Record lifecycle decisions with request or execution ID, execution path, provider registration,
capability category, model ID, effective state, notice code, deadline presence, and allow or deny
outcome. Count deprecated use, deadline denials, retired or catalogue-only attempts, unknown-state
failures, dynamic lifecycle synthesis failures, and trusted legacy derivations by provider. Alert on
unknown states only after trusted identity resolution, duplicate canonical IDs, executable retired
records, expired deprecation records, reconciled providers still using fallback, and policy references
that do not resolve to explicit active records.

Do not log prompts, response bodies, provider credentials, raw session tokens, or lifecycle data
supplied by a client. Lifecycle changes are reviewed catalogue changes rather than user-controlled
configuration. A lifecycle denial happens before provider I/O and therefore has no provider retry;
ordinary retries re-enter the guard and cannot extend a model past its deadline.

## Consequences

One upstream model can now remain active on one provider surface while retiring on another without a
global family flag lying to either path. Deprecated models remain usable for deliberate migration,
while automatic selection and all non-executable states stay fail-closed. Saved work remains truthful
and repairable instead of being silently changed.

The contract adds lifecycle detail without weakening ADR 0030's server authority or ADR 0031's
registry-owned Realtime catalogue. Catalogue maintenance becomes stricter: provider facts must be
reviewed per surface, replacement targets must resolve, deadlines become enforceable policy, and
historical records remain in the catalogue for as long as durable references exist.

## Rejected alternatives

- **Keep `deprecated` as a boolean.** It cannot distinguish warning, hard retirement, descriptive
  records, or independent provider surfaces.
- **Key lifecycle by maker, family, or remote model name.** Those identities span surfaces with
  different dates, credentials, capabilities, and provider contracts.
- **Use the merged map key or generate collision suffixes as durable identity.** Merge order can change
  those keys. Explicit canonical IDs and duplicate validation preserve historical references.
- **Make every deprecated model non-executable.** That gives no managed migration window and breaks
  saved work before the provider deadline. Automatic selection still excludes deprecated models.
- **Silently replace saved models.** A replacement can change behaviour, price, residency, tools, or
  authority and cannot be treated as equivalent.
- **Let each provider adapter enforce its own lifecycle.** Direct, agent, task, auxiliary, and
  Realtime paths would drift and explicit IDs would retain bypasses.
- **Delete retired records.** Historical messages and saved objects would lose a stable display and
  actionable remediation path.
- **Trust clients to enforce lifecycle.** Rolling or hostile clients can send explicit IDs; only the
  server can prevent provider I/O consistently.
