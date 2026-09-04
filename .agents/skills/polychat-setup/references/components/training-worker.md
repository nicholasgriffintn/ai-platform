# Training Worker

`apps/training` executes provider training and deployment jobs. The API owns the trainable model catalogue, user access, dataset export and dispatch; the Worker receives resolved definitions and owns provider calls, D1 job/deployment records and events.

## Configure

Bind the Worker's D1 database and the API's `TRAINING_WORKER` service. Share `TRAINING_WORKER_TOKEN` as a secret in both environments. Provision AWS credentials, roles, regions and buckets from the example variables for the selected provider only.

Keep API invocation credentials distinct from training credentials: the API's SageMaker chat variables differ from the Worker's training variables. Use each component's example file rather than copying one environment into the other. Database changes use the API Drizzle migration workflow.

## Choose a deployment path

- `sagemaker-endpoint` creates a model, endpoint configuration and realtime endpoint.
- `sagemaker-serverless-endpoint` requires a CPU-compatible inference image; GPU images require a suitable realtime endpoint.
- `bedrock-import` imports model files from S3. Use import-ready files such as weights, config and tokeniser data, not SageMaker's ordinary `model.tar.gz`. The optional Hub staging path requires bucket access and, for private models, a Hugging Face token.

`BEDROCK_ROLE_ARN` must be assumable by Bedrock and able to read the source bucket. Inspect provider IAM and selected model requirements before submission.

Use a stable deployment name with `deploymentVersion` to update a named SageMaker endpoint; omitting the name creates a separately versioned endpoint. Ready deployments re-enter the ordinary API model catalogue and access checks.

Deletion attempts provider cleanup, but may remove the local record while returning `manualDeletionRequired: true`. Treat that result as an outstanding AWS cleanup action, not successful resource deletion. Keep the provider identity needed for reconciliation.

Use `pnpm --filter @assistant/training typecheck` and API checks for contract changes. `pnpm dev:training` is for necessary runtime testing; `pnpm deploy:training` publishes the Worker and requires deployment authority.
