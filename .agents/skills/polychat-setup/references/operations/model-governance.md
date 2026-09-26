# Operate the model platform

Work › Models lets a workspace bring in models and data, train and evaluate them, and serve them behind stable aliases on provider accounts it connects itself. Every step leaves evidence, and approvals pin exact commits or content hashes. Read ADRs 0062–0070 before changing how versions, policies, routes, deployments or spend behave.

## Configure

- **Provider accounts:** anyone with the `manage_connections` action connects providers under Models › Governance: Hugging Face, AWS (Bedrock and SageMaker), Together, Fireworks, Nebius, Google Vertex, Azure AI Foundry, RunPod, Cloudflare Workers AI and any OpenAI-compatible endpoint. Training and serving run in those accounts and bill them directly. "Check before saving" shows what the credentials can read, store, train and host.
- **Storage:** secrets are sealed with `PRIVATE_KEY` and never returned. Uploads, dataset splits, training reports and eval results live in `PRIVATE_ASSETS_BUCKET`. Presigned part and report URLs need `ASSETS_BUCKET_ACCESS_KEY_ID`, `ASSETS_BUCKET_SECRET_ACCESS_KEY`, `ACCOUNT_ID` and `PRIVATE_ASSETS_BUCKET_NAME`. Uploaded weights are published to a private repository in the workspace's Hugging Face namespace when one is connected (ADR 0070).
- **Database:** apply migration `0054_model_platform` with the usual D1 commands. It drops the old training worker tables and `model_build`, clears the pre-platform Hugging Face connections and removes the retired personal Training app, so workspaces reconnect once.
- **Cron:** the `*/15 * * * *` trigger queues `model_platform_reconcile` for every workspace with live deployments or runs. The 03:00 schedule expires approvals and queues replays.

## Run

- Datasets process in batches through `model_dataset_process`: canonicalise, deduplicate, drop rows that overlap chosen eval suites, redact personal data and split deterministically. Empty column mappings are detected from the first row.
- Training runs submit to the chosen trainer and poll through `model_training_sync`. Trainers report metrics to a presigned R2 URL. Outputs register as new versions with lineage, compute and dataset evidence, and re-enter review.
- Deployments create and poll the host through `model_deployment_sync`, accrue estimated cost while billable and register a route that chat reaches as `deployment:<id>`. Aliases (`alias:<id>`) are what clients should call.
- Starts check the budget first. Over the approval threshold, members file a spend request; an approver with `approve` starts it from Governance. Over a hard stop, starts are refused and reconcile pauses running deployments.

## Recover

- **Provider refused credentials:** re-check the connection under Governance. The message names the missing capability.
- **Run stuck in submitted or running:** reconcile resyncs anything not checked for 30 minutes. Check the job in the provider console with the run's provider job id.
- **Deployment still billing after delete:** the audit trail records `model_deployment.removed_from_provider`. If it is missing, remove the resource in the provider console.
- **A version must stop now:** Revoke on the version page revokes approvals, retires routes, pauses deployments and clears aliases for it and everything trained from it.
- **Erasure request:** select the rows on the dataset page and erase them. A clean revision is cut and every model trained on the old one is flagged to retrain or withdrawn.
