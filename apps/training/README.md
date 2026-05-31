# Polychat Training Worker

The Worker in `apps/training` is used by the API to start, inspect, and deploy provider-backed training jobs. It is not a CLI. The API owns model and provider selection, resolves the model definition, exports datasets when needed, then calls this Worker through Worker bindings.

Use this Worker for:

- Starting AWS Bedrock model customisation jobs.
- Starting AWS SageMaker Hugging Face training jobs.
- Creating SageMaker real-time and serverless deployments for model artifacts.
- Staging Hugging Face model files to S3 and creating Bedrock model import jobs.
- Tracking deployment versions passed from the API.
- Persisting training jobs, deployments, and job events in D1.
- Returning provider status to the API without duplicating model catalogs.

## Architecture

The API is the control plane:

- `apps/api/src/lib/providers/capabilities/training/modelCatalog.ts` defines trainable models.
- `apps/api/src/services/training` validates requests, exports D1 training examples to S3, and calls the training Worker.
- `apps/api/src/routes/training.ts` exposes `/training/models`, `/training/jobs`, `/training/jobs/:provider/:jobName`, `/training/jobs/:provider/:jobName/events`, and deployment routes.
- Ready deployments are surfaced back into the normal model list through `filterModelsForUserAccess`, so Polychat can use them as chat models without separate frontend configuration.

The training Worker is the execution plane:

- `src/index.ts` exposes internal Worker HTTP routes.
- `src/services/TrainingWorkerService.ts` coordinates provider calls and persistence.
- `src/lib/TrainingStore.ts` stores jobs, deployments, and events in D1.
- `src/providers` contains provider adapters for `aws-bedrock` and `aws-sagemaker`.

Provider adapters do not own the model catalog. The API passes the resolved model definition in each Worker request.

## Configuration

Install dependencies from the repository root:

```sh
pnpm install
```

Copy the example variables for local Worker development:

```sh
cp apps/training/.env.example apps/training/.dev.vars
```

The Worker requires the `DB` D1 binding from `wrangler.json`. Provider credentials are read from Worker secrets or local `.dev.vars`.

Shared AWS values:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` optional
- `AWS_REGION`

Bedrock jobs also use:

- `BEDROCK_OUTPUT_BUCKET`
- `BEDROCK_IMPORT_BUCKET` optional override for staged Bedrock import files
- `BEDROCK_ROLE_ARN`
- `BEDROCK_KMS_KEY_ARN` optional
- `BEDROCK_VPC_SECURITY_GROUP_IDS` optional comma-separated list
- `BEDROCK_VPC_SUBNET_IDS` optional comma-separated list
- `HUGGINGFACE_TOKEN` optional for private or gated Hugging Face models

For `bedrock-import`, `BEDROCK_ROLE_ARN` must be assumable by `bedrock.amazonaws.com`
and must allow `s3:GetObject` and `s3:ListBucket` for the model source bucket.

SageMaker jobs and deployments also use:

- `SAGEMAKER_REGION`
- `SAGEMAKER_ROLE_ARN`
- `SAGEMAKER_OUTPUT_BUCKET`
- `SAGEMAKER_VOLUME_SIZE_GB` optional
- `SAGEMAKER_AWS_ACCESS_KEY_ID` optional override
- `SAGEMAKER_AWS_SECRET_ACCESS_KEY` optional override
- `SAGEMAKER_AWS_SESSION_TOKEN` optional override

The API chat runtime uses `SAGEMAKER_AWS_ACCESS_KEY`, `SAGEMAKER_AWS_SECRET_KEY`, and `SAGEMAKER_AWS_REGION` when invoking ready SageMaker deployments from Polychat.

The API Worker must define this service binding:

```json
{
	"binding": "TRAINING_WORKER",
	"service": "assistant-training-worker"
}
```

The API Worker and training Worker must also share `TRAINING_WORKER_TOKEN`.
Set it as a secret in both environments. Every non-status worker route rejects requests without that token, and user ownership is passed as internal request context from the API.

## Development

Run static checks:

```sh
pnpm --filter @assistant/training typecheck
pnpm --filter @assistant/api typecheck
```

Run the Worker locally only when you need to exercise service-binding behaviour:

```sh
pnpm --filter @assistant/training dev
```

Routine validation should use typechecks and tests, not a dev server.

## Database

Training state lives in D1 tables:

- `training_jobs`
- `training_deployments`
- `training_job_events`

Do not hand-write migration SQL or edit migration metadata. Update the Drizzle schema, then use the API package migration workflow:

```sh
pnpm --filter @assistant/api db:generate
```

If Drizzle cannot generate a clean migration because migration metadata is out of sync, fix that workflow issue first. Do not patch generated migration files manually.

## API Flow

Start a job through the API:

```http
POST /training/jobs
```

The API request includes `provider`, `modelId`, and dataset input. When `trainingExampleFilters` are provided, the API exports examples to S3 before calling the Worker. The Worker receives a concrete model definition and a `trainS3Uri`.

Inspect a job:

```http
GET /training/jobs/aws-sagemaker/my-training-job
GET /training/jobs/aws-sagemaker/my-training-job/events
```

Deploy model artifacts:

```http
POST /training/deployments
GET /training/deployments/aws-sagemaker/my-endpoint
DELETE /training/deployments/aws-sagemaker/my-endpoint
```

Set `deploymentTarget` to choose the provider path:

- `sagemaker-endpoint` creates a SageMaker model, endpoint config, and real-time endpoint.
- `sagemaker-serverless-endpoint` creates the same SageMaker model with a serverless endpoint config. This only works with CPU-compatible inference images. GPU images such as CUDA/TGI should use a real-time GPU endpoint.
- `bedrock-import` creates a Bedrock model import job. This does not need a SageMaker endpoint. If `modelArtifactsS3Uri` is omitted for a Hugging Face catalog model, the Worker copies the model files from Hugging Face to `BEDROCK_IMPORT_BUCKET` or `BEDROCK_OUTPUT_BUCKET` before starting the import job. You can still pass an existing S3 prefix, or use a completed training job that exposes import-ready model files.

Bedrock import should not be pointed at SageMaker's normal `model.tar.gz` output. Bedrock expects the model source in S3 to contain files such as `.safetensors`, `config.json`, and tokenizer files. The automatic Hub staging path writes those files under `models/<model-id>/` in the import bucket and skips files that are already present.

For SageMaker Hugging Face models, a real-time or serverless deployment request can omit
`trainingJobName` and `modelArtifactsS3Uri`. In that case the API passes `HF_MODEL_ID`
from the model catalog and SageMaker deploys the base Hub model with the configured
inference image.

Use `deploymentVersion` when updating a named deployment. With a stable
`deploymentName`, the Worker keeps the SageMaker endpoint name the same, creates a new
versioned model and endpoint config, then calls `UpdateEndpoint` so AWS moves traffic to
that config. For example, `deploymentName: lizzy-7b` and `deploymentVersion: 1.1`
updates `lizzy-7b-endpoint` to use `lizzy-7b-1-1-config`.

If `deploymentName` is omitted, the Worker uses the model id plus version to create a
separate versioned endpoint, for example `lizzy-7b-v1-endpoint`.

Deleting a deployment first attempts provider cleanup. If AWS denies the delete action or
the provider cleanup fails, the Worker still removes the Polychat deployment record and
returns `manualDeletionRequired: true` so the UI can tell the user to clean up the AWS
resource manually.

Deployment events are stored against the endpoint name. The API exposes those events to
the frontend so update requests show the submitted config and completion state alongside
the deployment record.

When a deployment is ready, the API exposes a generated chat model id:

```text
training:aws-sagemaker:lizzy-7b-v1-endpoint
```

SageMaker deployments are invoked through SageMaker Runtime. Completed Bedrock imports
are exposed through the existing Bedrock chat provider using the imported model ARN.
