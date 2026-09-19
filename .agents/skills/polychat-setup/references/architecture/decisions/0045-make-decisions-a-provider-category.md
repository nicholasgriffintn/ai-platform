# ADR 0045: Make decisions a provider category, starting with TypeSafe Jev

Status: Implemented. `decision` is a category in `AiProviderMap`; TypeSafe Jev is its first provider; `ai.decide` and the `decision` system role expose it.

## Problem

Polychat makes many small judgements inside hot paths: is this message worth remembering, is this prompt safe, which capability matches this request, how good is this training example. Every one of them ran through a chat model with a JSON schema, which costs a full LLM call (seconds and cents) for a yes/no or a label, and returns a point estimate with no honest measure of certainty. Thresholds written against those answers mean nothing, so code either trusts the label blindly or asks a person.

TypeSafe's Jev is a different kind of model. It takes a state and a map of typed questions (`choice`, `score`, `noul`) and returns calibrated probabilities in about 150ms for $0.042 per million input tokens. It never generates text. That shape fits none of the existing categories: it is not chat, not guardrails, not search.

## Decision

Decisions are a provider category of their own, vendor neutral, with the wire contract in `packages/schemas/src/decisions.ts`. The contract adopts TypeSafe's request and answer shapes as the standard (state, question map, typed answers with probabilities and confidence) plus a `provider` field, so a second vendor or an LLM-logprob adapter can implement the same interface without callers changing.

- `packages/ai-providers` owns `DecisionProvider` and the `typesafe` implementation (aliases `typesafe-ai`, `jev`). It is a thin `fetchProviderJson` client rather than the vendor SDK, credentialled through `resolveProviderApiKey` with `TYPESAFE_API_KEY` or a user's stored key. `ProviderHost.models.getAuxiliaryDecisionModel` answers whether an account has a decision model; it returns `null` rather than throwing, because decisions are an accelerator, never a dependency.
- The catalogue lists `jev-latest`, `jev-preview` and `jev-1.13.0` under a new `decision` output modality, priced on input tokens only. The modality keeps them out of chat surfaces and the tier lineups; the `decision` system role in `model-lineup.ts` selects them.
- `packages/ai-functions` exposes `decide`, `tryDecide`, `canDecide` and the `choice`/`score`/`noul` builders. `classify`, `score` and `is` route through the decision model when one resolves and fall back to `generateObject` otherwise.
- Billing meters `decide` on `input_tokens` through the capability meter table, so platform-key usage lands in the ledger like every other capability.

Hot paths adopt it through `tryDecide`, so they behave identically without a key:

- Memory: a `worth_remembering` noul gates the LLM classifier and skips it below 0.25.
- Guardrails: a `typesafe` `GuardrailsProvider` screens with four hazard nouls and a severity score, selectable as `guardrails_provider`.
- Capability discovery: one Choice per batch of up to 254 capabilities ranks them semantically in a single request, and the probability is added to the keyword score.
- Training quality: a five-level Score replaces the free-text 1–10 prompt when available.

Users reach it through `POST /decisions`, the `decide` tool, and a BYOK entry for `typesafe` in provider settings.

## Consequences

Judgements that gate other work are now cheap enough to run on every event and calibrated enough to threshold. Code owns the thresholds, and the confidence bands in `decisionConfidenceBand` (below 0.5 escalate, above 0.9 act) give a shared vocabulary for deciding when to act automatically.

Jev is English-first and text-only, and a request is capped at 64k tokens with 32k for state plus the longest question, so callers trim long histories before asking. The Vercel AI Gateway catalogue sync also imports `typesafe-ai/jev` as a text model; it is not a chat model and should not be selected as one.

Model routing by prompt is explicitly out of scope: the tier lineup replaced prompt scoring and this category does not reopen that decision.
