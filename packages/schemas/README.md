# @ngriffin_uk/polychat-schemas

Shared Zod schemas for the Assistant application. This package provides reusable type definitions and validation schemas used across the web, API, and other applications in the workspace.

## Installation

This package is part of the monorepo and should be installed via the workspace:

```bash
pnpm install
```

## Usage

```typescript
import { messageSchema } from "@ngriffin_uk/polychat-schemas";

const result = messageSchema.parse(data);

type Message = z.infer<typeof messageSchema>;
```

## Memory documents

Apply migration `0059_native_memory` before deploying the new memory contracts. Send `tier` (`core` or `reference`) and a `summary` of at most 500 characters on every document creation and revision. Keep the content, placement and description in the same expected-revision write; history records all three.

Keep core documents in context when they fit the memory budget. Expose references and oversized core documents through the bounded index and `read_memory_document`, using the document ID, revision and returned `nextOffset`. Restart at offset zero when a revision changes; never combine pages from different revisions.

Read projection status in context protocol version 2. An `included` document has its content in the prompt, a `deferred` document is indexed for retrieval, and an `omitted` document does not fit even the index. The migration transitions stored snapshots to this contract and marks historical token estimates as unavailable.

Request teammate memory maintenance with `POST /teammates/contexts/:contextId/memory/maintenance` and read its status with `GET` on the same path. Require the context owner's request. The **Tidy memory** control uses the configured auxiliary model and existing credit accounting to reconcile the memory with trusted user messages from that teammate's conversation.

Use messages with an authorised user run as new evidence. Exclude automated turns, assistant and tool output, imported messages and history without run provenance.

Capture durable teammate corrections after stored user turns when memory saving is enabled. Reuse the memory classification gate and task queue; recheck saving consent before enqueueing, processing and committing. Route the teammate's `store_memory` calls through the same worker using the actual user message as evidence rather than saving model-generated text. Keep journals and other granted documents on their existing storage path.

Bound each source batch to 64 messages and 6,000 estimated tokens, and each model call to 2,048 output tokens and five estimated credits. Require exact source quotes for corrections, reject ambiguous replacements, and preserve unrelated content. Commit the revision and source checkpoint together under the current document revision, context owner and task lease; retry conflicts against current state without consuming evidence.

Reserve space for the current memory, system instructions, encoded source metadata and output before selecting evidence. Reduce each batch to fit the configured model's context window. Advance ranges without usable user text without calling a model or creating a redundant revision.

Record model usage before validating structured output. A malformed response still consumes provider resources; retain its usage accounting while rejecting the correction and leaving the source checkpoint unchanged.

## Model spend requests

Use `SPEND_REQUEST_STATES` when displaying spend requests. Only `pending` requests accept approval or rejection. Approval first claims the request as `executing`, then records `approved` with its resource ID or `failed` if execution throws.

Do not retry a failed or interrupted execution automatically: a provider resource may already exist. Check the workspace's training runs or deployments before submitting another request. An interrupted worker can leave a request in `executing`, which requires operator investigation.

Handle `spendRequestId` on deployment resume and scale responses. When present, the deployment remains unchanged until approval. Approval rechecks the budget and rejects requests whose deployment configuration has changed.

Read `pauseSupported` before offering deployment pause controls. Hosts with this capability set to `false` cannot satisfy hard-stop or idle-pause budgets. Delete their deployments to stop dedicated compute.

## Model provider creation and cancellation

Apply migration `0055_model_provider_claims` before deploying the API changes. Provider creation claims persist on training runs and deployments, so overlapping tasks cannot create duplicate paid resources. The migration treats existing non-pending deployments without a provider reference as already claimed.

Keep a claim through each paid provisioning step, including creating a Together endpoint after uploading its model. Clear the claim only when the new provider reference is saved. A failed continuation requires provider reconciliation before retrying.

Do not clear a creation claim or resubmit after an interrupted request until you check the provider account. After thirty minutes without a resource identifier, the task reports an unknown outcome. Reconcile the existing provider job or resource identifier before polling again; a provider may have accepted a request whose response was lost.

Display `cancelling` as an active training state. Cancellation remains pending until the provider reports a terminal state, including when the request arrives during submission. Retain reported cancellation costs, or the existing estimate when the provider supplies no final cost.
