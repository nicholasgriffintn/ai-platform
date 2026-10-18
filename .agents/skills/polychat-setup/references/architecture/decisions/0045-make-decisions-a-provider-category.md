# ADR 0045: Make decisions a provider category, starting with TypeSafe Jev

Status: Implemented. `decision` is a category in `AiProviderMap`; TypeSafe Jev, Workers AI Clef and OpenAI Decisions implement it; `ai.decide` and the `decision` system role expose it.

## Problem

Polychat makes many small judgements inside hot paths: is this message worth remembering, is this prompt safe, which capability matches this request, how good is this training example. Every one of them ran through a chat model with a JSON schema, which costs a full LLM call (seconds and cents) for a yes/no or a label, and returns a point estimate with no honest measure of certainty. Thresholds written against those answers mean nothing, so code either trusts the label blindly or asks a person.

TypeSafe's Jev is a different kind of model. It takes a state and a map of typed questions (`choice`, `score`, `noul`) and returns calibrated probabilities in about 150ms for $0.042 per million input tokens. It never generates text. That shape fits none of the existing categories: it is not chat, not guardrails, not search.

## Decision

Decisions are a provider category of their own, vendor neutral, with the wire contract in `packages/schemas/src/decisions.ts`. The contract adopts TypeSafe's request and answer shapes as the standard (state, question map, typed answers with probabilities and confidence) plus a `provider` field, so a second vendor or an LLM-logprob adapter can implement the same interface without callers changing.

- `packages/ai-providers` owns `DecisionProvider` and the `typesafe` implementation (aliases `typesafe-ai`, `jev`). It is a thin `fetchProviderJson` client rather than the vendor SDK, credentialled through `resolveProviderApiKey` with `TYPESAFE_API_KEY` or a user's stored key. `ProviderHost.models.getAuxiliaryDecisionModel` answers whether an account has a decision model and returns `null` rather than throwing. Each caller owns the unavailable/failure fallback; safety gates may deliberately fail closed.
- Decision models use the `decision` output modality, which keeps them out of chat surfaces and the tier lineups; the `decision` system role in `model-lineup.ts` selects them.
- Further vendors, such as Workers AI Clef and OpenAI, implement the same contract and validate their own limits before inference. The automatic lineup order lives in `model-lineup.ts`, not here.
- `packages/ai-functions` exposes `decide`, `tryDecide`, `canDecide` and the `choice`/`score`/`noul` builders. `classify`, `score` and `is` route through the decision model when one resolves and fall back to `generateObject` otherwise.
- Repeated product gates use `defineDecisionPolicy` and `evaluateDecisionPolicy`. A policy has a stable key and version, typed questions, code-owned thresholds, an explicit `shadow`, `advisory` or `live` mode and a caller-owned fallback. Its compact receipt records the recommendation, confidence, metrics, provider and model without copying the judged state or provider error.
- Billing meters `decide` on `input_tokens` through the capability meter table, so platform-key usage lands in the ledger like every other capability.

Callers adopt it through `tryDecide`, so they behave identically without a decision model. Memory gating, guardrails, capability ranking, tool intent, recipe and channel triage, goal completion and task kill conditions all use it this way, and a judgement never grants authority: low confidence on a side-effectful call enters the approval path rather than skipping it.

Users reach it through `POST /decisions`, the `decide` tool, and a BYOK entry for `typesafe` in provider settings.

## Consequences

Judgements that gate other work are now cheap enough to run on every event and calibrated enough to threshold. Code owns the thresholds, and the confidence bands in `decisionConfidenceBand` (below 0.5 escalate, above 0.9 act) give a shared vocabulary for deciding when to act automatically. A judgement is evidence for its caller, never authentication, authorisation, proof of external state or permission to execute a side effect; callers revalidate those separately.

Jev is English-first and text-only, and a request is capped at 64k tokens with 32k for state plus the longest question, so callers trim long histories before asking. The Vercel AI Gateway catalogue sync also imports `typesafe-ai/jev` as a text model; it is not a chat model and should not be selected as one.

Model routing by prompt is explicitly out of scope: the tier lineup replaced prompt scoring and this category does not reopen that decision.
