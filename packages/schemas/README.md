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
