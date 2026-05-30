# Polychat Finetune Worker

The finetune app is a Cloudflare Worker service used by the API to start, inspect, and deploy provider-backed training jobs. It is not a CLI. The API owns model and provider selection, resolves the model definition, exports datasets when needed, then calls this Worker through the `FINETUNE_WORKER` service binding.

Use this Worker for:

- Starting AWS Bedrock model customisation jobs.
- Starting AWS SageMaker Hugging Face training jobs.
- Creating SageMaker deployments for completed model artifacts.
- Persisting training jobs, deployments, and job events in D1.
- Returning provider status to the API without duplicating model catalogs.

## Architecture

The API is the control plane:

- `apps/api/src/lib/providers/capabilities/training/modelCatalog.ts` defines trainable models.
- `apps/api/src/services/training` validates requests, exports D1 training examples to S3, and calls the finetune Worker.
- `apps/api/src/routes/training.ts` exposes `/training/models`, `/training/jobs`, `/training/jobs/:provider/:jobName`, `/training/jobs/:provider/:jobName/events`, and deployment routes.

The finetune Worker is the execution plane:

- `src/index.ts` exposes internal Worker HTTP routes.
- `src/services/TrainingWorkerService.ts` coordinates provider calls and persistence.
- `src/services/TrainingStore.ts` stores jobs, deployments, and events in D1.
- `src/providers` contains provider adapters for `aws-bedrock` and `aws-sagemaker`.

Provider adapters do not own the model catalog. The API passes the resolved model definition in each Worker request.

## Configuration

Install dependencies from the repository root:

```sh
pnpm install
```

Copy the example variables for local Worker development:

```sh
cp apps/finetune/.env.example apps/finetune/.dev.vars
```

The Worker requires the `DB` D1 binding from `wrangler.json`. Provider credentials are read from Worker secrets or local `.dev.vars`.

Shared AWS values:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` optional
- `AWS_REGION`

Bedrock jobs also use:

- `BEDROCK_OUTPUT_BUCKET`
- `BEDROCK_ROLE_ARN`
- `BEDROCK_KMS_KEY_ARN` optional
- `BEDROCK_VPC_SECURITY_GROUP_IDS` optional comma-separated list
- `BEDROCK_VPC_SUBNET_IDS` optional comma-separated list

SageMaker jobs also use:

- `SAGEMAKER_REGION`
- `SAGEMAKER_ROLE_ARN`
- `SAGEMAKER_OUTPUT_BUCKET`
- `SAGEMAKER_VOLUME_SIZE_GB` optional
- `SAGEMAKER_AWS_ACCESS_KEY_ID` optional override
- `SAGEMAKER_AWS_SECRET_ACCESS_KEY` optional override
- `SAGEMAKER_AWS_SESSION_TOKEN` optional override

The API Worker must define this service binding:

```json
{
	"binding": "FINETUNE_WORKER",
	"service": "assistant-finetune-worker"
}
```

The API Worker and finetune Worker must also share `FINETUNE_WORKER_TOKEN`.
Set it as a secret in both environments. Every non-status worker route rejects requests without that token, and user ownership is passed as internal request context from the API.

## Development

Run static checks:

```sh
pnpm --filter @assistant/finetune typecheck
pnpm --filter @assistant/api typecheck
```

Run the Worker locally only when you need to exercise service-binding behaviour:

```sh
pnpm --filter @assistant/finetune dev
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

Deploy SageMaker artifacts:

```http
POST /training/deployments
GET /training/deployments/aws-sagemaker/my-endpoint
```

Bedrock deployment is not automated by this Worker yet. Bedrock jobs can be started and inspected, but provisioned throughput remains a separate workflow.
