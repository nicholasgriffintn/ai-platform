# Operate model governance

Work › Models lets a workspace find, vet, evaluate, fine-tune and serve open models, with every approval pinned to a Hub commit. Read ADRs 0062–0069 before changing how versions, policies, routes or builds behave.

## Configure

- **Workspaces:** an admin connects Hugging Face under Models › Govern (ADR 0069). Use a write token, or a fine-grained token with write access to the organisation's repositories and Inference Endpoints, and pick the organisation that owns and pays for jobs, output repositories and endpoints. Without a connection, search and import still work for public repositories, but Build and Deploy stay off.
- **Platform default (optional):** `HUGGINGFACE_TOKEN`, `HUGGINGFACE_NAMESPACE`, `HUGGINGFACE_ENDPOINT_VENDOR` and `HUGGINGFACE_ENDPOINT_REGION` on the API act as the connection for workspaces that have not added their own. Prefer an organisation token, because personal tokens hit the 1,000 requests per 5 minutes free-tier limit quickly. The training worker's own copies only serve the legacy provider jobs; registry calls pass credentials to it per request.
- **Storage:** connection tokens are sealed with `PRIVATE_KEY`. Eval case results use the existing `PRIVATE_ASSETS_BUCKET` under `model-registry/eval-runs/`. Weights are never copied and everything reads from the Hub at the pinned commit (ADR 0066). Hugging Face Jobs read training data from a 12-hour presigned S3 URL, so the worker also needs the AWS credentials it already uses for SageMaker.
- **Database:** apply migrations `0052_model_registry` and `0053_workspace_provider_connections` with the usual D1 commands. Neither needs a backfill.

## Run

- Imports queue `model_registry_inspect`. Inspection records evidence and opens or auto-approves a workspace decision.
- Eval runs execute 20 cases per `model_registry_eval` task and write per-case results to R2. Runs against a new endpoint wait up to three hours for it to come up.
- Every cron tick syncs running builds, pinning the output commit and queuing inspection when a job completes. The 03:00 schedule expires lapsed approvals and queues a replay for each suite and route pair that has a completed baseline run.

## Enforce

Governance is advisory until an admin ticks "Enforce in project chats" on the workspace policy. Then project chats may only use approved routes; tier-selected models fall back to the first approved route, and explicitly chosen models that are not approved return a 403 that names them. Generations through approved routes carry `polychat.route_id` and `polychat.asset_version_id` in analytics.

## Recover

- **Inspection failed:** the version page shows the reason. Admins can queue a fresh inspection with "Re-inspect".
- **Build or deploy returns 409:** the workspace has no Hugging Face connection that can write to its namespace. Connect or change it under Govern.
- **Retired route still billing:** retiring deletes the endpoint with the workspace's credentials. If the audit record shows `endpointDeleted: false`, delete it in the Hugging Face console.
- **Build stuck:** check the job in the Hugging Face console under the workspace's organisation. The build finishes once the job reports `COMPLETED` or `ERROR`.
