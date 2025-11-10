# Polychat - Bedrock Fine-Tuning Toolkit

This is a standalone toolkit for building fine tuned models on Amazon Bedrock using the Polychat API to generate custom datasets.

Specifically, the goal here is to be able to create a fine tuned version of the Amazon Nova models using generated datasets from larger models, using the Polychat API as the data source.

Initially, we will be fine-tuning a model for Strudel live-coding generation, however, it is the aim of this app to be able to expand for more use cases in the future. The hope is that these fine tuned models will be more reliable and consistent for specialized tasks than relying on prompt engineering alone, this is because they will have:

- Domain specific knowledge baked into the models weights
- They should be more consistent about following the desired output format and style guidelines
- They should be faster and cheaper to run in production
- They should require taking up less of the context window with instructions and examples

### Why AWS Bedrock and Amazon Nova?

You can use a bunch of different platforms for fine-tuning, including doing it locally.

Personally, I've chosen to use AWS Bedrock as the learnings from using this system will be much more applicable to my day to day work and it doesn't require me to set up a whole lot of stuff outside of the job of actually fine-tuning.

AWS Bedrock will also handle all of the infrastructure and host the model for its eventual usage in Polychat.

## Architecture Overview

This app has been designed to be fully decoupled from the rest of the monorepo, it can be called using a CLI locally, will use the Polychat API to generate training data, the AWS SDK to interact with Bedrock and S3, and will track everything locally using SQLite for reproducibility.

### Data Flow

1. Polychat API is called multiple times with different prompts to generate training examples
2. Generated examples are formatted into Bedrock JSONL format
3. Dataset is uploaded to S3
4. Bedrock Fine-Tuning job is created using the dataset in S3
5. Once training is complete, the fine-tuned model is provisioned for usage
6. All steps are tracked in a local SQLite database for reproducibility

### System Prompt Configuration

Prompt templates are stored in `configs/strudel-prompts.json`:

**Structure:**

```json
{
  "baseSystemPrompt": "You are an expert Strudel live-coding assistant...",
  "styleGuides": {
    "techno": "Techno-specific instructions...",
    "house": "House-specific instructions..."
  },
  "complexityGuides": {
    "simple": "Simple complexity instructions...",
    "medium": "Medium complexity instructions..."
  },
  "promptTemplates": {
    "techno": ["Create a minimal techno loop...", ...]
  }
}
```

The aim is for this to be something that's super extendable and reusable for different projects in the future.

### Bedrock JSONL

As we are fine-tuning a model in Bedrock, our dataset will need to be in the correct format that Bedrock expects, this is called Bedrock JSONL and looks like this:

```json
{
	"schemaVersion": "bedrock-conversation-2024",
	"system": [
		{
			"text": "You are an expert Strudel live-coding assistant..."
		}
	],
	"messages": [
		{
			"role": "user",
			"content": [
				{
					"text": "Create a techno beat with 4-on-the-floor kick"
				}
			]
		},
		{
			"role": "assistant",
			"content": [
				{
					"text": "stack(s(\"bd*4,hh*8\").bank(\"RolandTR909\")...)"
				}
			]
		}
	]
}
```

### Local Job Tracking

We are using SQLite to track all of the jobs and the dataset records as they are processed by the CLI locally, this is stored in the `datasets/` directory and includes the following tables:

- `jobs`: Fine-tuning job records
- `datasets`: Generated dataset records

## Prerequisites

### Local Requirements

1. **Node.js** v22 or higher
2. **pnpm** package manager
3. **Environment Variables**:
   - Run the following command to copy the example env file:
     ```bash
     cp .env.example .env
     ```
   - Update the `.env` file with your settings.
4. **Run `pnpm install`** to install dependencies
5. **Initialize the database**:
   ```bash
   pnpm tsx src/cli.ts db init
   ```
   This creates the SQLite database with the required tables for tracking datasets and jobs.

### AWS Requirements

1. **AWS Account** with Bedrock access
2. **Bedrock Model Access**:
   - Go to AWS Bedrock Console → Model access
   - Request access to Amazon Nova Pro (or Lite/Micro) and wait for approval

3. **S3 Buckets**:
   - Create one for the training data
   - Create one for the training outputs

4. **IAM Role** with the trust policy:

   ```json
   {
   	"Version": "2012-10-17",
   	"Statement": [
   		{
   			"Effect": "Allow",
   			"Principal": { "Service": "bedrock.amazonaws.com" },
   			"Action": "sts:AssumeRole",
   			"Condition": {
   				"StringEquals": { "aws:SourceAccount": "your-account-id" }
   			}
   		}
   	]
   }
   ```

and permissions (be sure to replace the bucket names):

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"bedrock:CreateModelCustomizationJob",
				"bedrock:GetModelCustomizationJob",
				"bedrock:ListModelCustomizationJobs",
				"bedrock:StopModelCustomizationJob"
			],
			"Resource": "*"
		},
		{
			"Effect": "Allow",
			"Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
			"Resource": [
				"arn:aws:s3:::your-training-bucket/*",
				"arn:aws:s3:::your-training-bucket"
			]
		},
		{
			"Effect": "Allow",
			"Action": ["bedrock:InvokeModel"],
			"Resource": [
				"arn:aws:bedrock:us-east-1:your-account-id:inference-profile/us.amazon.nova-premier-v1:0"
			]
		}
	]
}
```

5. **IAM User** with programmatic access (access key + secret key)

## Usage Guide

### Command Structure

```
finetune <command> <subcommand> [options]
```

**Available commands:**

- `db` - Database management and initialization
- `dataset` - Generate, validate, and upload datasets
- `job` - Create and manage fine-tuning jobs
- `model` - Test and export fine-tuned models

### Database Commands

#### Initialize Database

Set up the SQLite database with required tables:

```bash
pnpm tsx src/cli.ts db init
```

**Options:**

- `--path <path>`: Database file path (default: `./datasets/.finetune.db`)
- `--force`: Reinitialize database even if it already exists

**What it does:**

Creates a SQLite database with the following tables:

- `jobs`: Tracks fine-tuning job records (ARN, name, status, metadata)
- `datasets`: Tracks generated datasets (paths, S3 URIs, metadata)

**Example Output:**

```
📦 Initializing new database at: /path/to/datasets/.finetune.db

✓ Created table: jobs
✓ Created table: datasets
✓ Created indexes

✓ Database initialized successfully!
```

**Note:** The database is automatically initialized when you run other commands, but using `db init` explicitly ensures proper setup and provides feedback.

### Dataset Commands

#### Generate Dataset

Generate synthetic training examples by calling your API:

```bash
pnpm tsx src/cli.ts dataset generate \
  --count 300 \
  --model claude-4-5-sonnet \
  --output ./datasets/strudel
```

**Options:**

- `--count`: Number of examples (default: 300)
- `--api-url`: Your API endpoint (default: from `.env`)
- `--api-key`: API authentication key (optional)
- `--model`: Model to use for generation
- `--styles`: Comma-separated styles (default: all 6 styles)
- `--complexities`: Comma-separated complexities (default: all 3)
- `--output`: Output directory

**What it does:**

This will call the API on Polychat the number of times that you have specified in `--count`, cycling through different style and complexity combinations to generate a diverse dataset that will be formatted and stored on disk.

These will be split into training and validation sets automatically and then recorded in the local SQLite database for tracking.
**Process:**

1. **Load prompt templates** from `configs/strudel-prompts.json`
2. **Generate combinations**: 6 styles × 3 complexities = 18 combinations
3. **For each combination**, generate ~15-20 examples with varying prompts
4. **HTTP POST to your API**: `/apps/strudel/generate`
5. **Receive Strudel code** responses
6. **Format as Bedrock JSONL**:
   ```jsonl
   {
   	"schemaVersion": "bedrock-conversation-2024",
   	"system": [
   		{
   			"text": "You are an expert..."
   		}
   	],
   	"messages": [
   		{
   			"role": "user",
   			"content": [
   				{
   					"text": "Create a techno loop"
   				}
   			]
   		},
   		{
   			"role": "assistant",
   			"content": [
   				{
   					"text": "stack(s(\"bd*4\")...)"
   				}
   			]
   		}
   	]
   }
   ```

**Example Output:**

```
datasets/strudel/
  ├─ train.jsonl       (240 examples)
  └─ validation.jsonl  (60 examples)
```

#### Validate Dataset

Validate dataset format before uploading:

```bash
pnpm tsx src/cli.ts dataset validate \
  --train ./datasets/strudel/train.jsonl \
  --validation ./datasets/strudel/validation.jsonl
```

This will ensure that the files are in the correct format that Bedrock expects and will provide statistics about the dataset.

#### Upload Dataset

Upload to S3 for Bedrock access:

```bash
pnpm tsx src/cli.ts dataset upload \
  --train ./datasets/strudel/train.jsonl \
  --validation ./datasets/strudel/validation.jsonl \
  --project strudel
```

**Output:**

```
S3 URIs:
  Training: s3://my-bucket/strudel/2025-11-09T12-00-00/train.jsonl
  Validation: s3://my-bucket/strudel/2025-11-09T12-00-00/validation.jsonl
```

### Job Commands

#### Create Fine-Tuning Job

Traditional fine-tuning adjusts all model weights using your training data:

```bash
pnpm tsx src/cli.ts job create \
  --name strudel-nova-pro-v1 \
  --base-model amazon.nova-pro-v1:0:300k \
  --train-uri s3://my-bucket/strudel/.../train.jsonl \
  --val-uri s3://my-bucket/strudel/.../validation.jsonl \
  --epochs 3 \
  --learning-rate 0.00001 \
  --batch-size 1
```

**Fine-Tuning Options:**

- `--name`: Job name (must be unique)
- `--base-model`: Foundation model ID
- `--train-uri`: S3 URI from upload step
- `--val-uri`: S3 URI for validation (optional)
- `--custom-name`: Custom model name (defaults to job name)
- `--epochs`: Number of training epochs (1-5, default: 3)
- `--learning-rate`: Learning rate (default: 0.00001)
- `--batch-size`: Batch size (default: 8)
- `--project`: Project name for organization (default: strudel)

#### Create Distillation Job

Distillation transfers knowledge from a larger teacher model to a smaller student model, creating a faster and more cost-effective model:

```bash
pnpm tsx src/cli.ts job distill \
  --name strudel-nova-pro-distilled \
  --teacher us.amazon.nova-premier-v1:0 \
  --student  amazon.nova-pro-v1:0:300k \
  --train-uri s3://my-bucket/strudel/.../train.jsonl \
  --val-uri s3://my-bucket/strudel/.../validation.jsonl \
  --project strudel
```

**Distillation Options:**

- `--name`: Job name (must be unique)
- `--teacher`: Teacher model identifier (larger, more capable model)
- `--student`: Student model identifier (smaller, faster model)
- `--train-uri`: S3 URI for training prompts (can be prompt-only or full conversations)
- `--val-uri`: S3 URI for validation data (optional)
- `--custom-name`: Custom model name (defaults to job name)
- `--project`: Project name for organization (default: strudel)

**What happens during training:**

1. **Initialization** (~5 min): Bedrock loads your data and validates format
2. **Training** (1-4 hours): Model learns from your examples
   - Processes training data in batches
   - Updates model weights based on loss function
   - Validates on validation set after each epoch
3. **Completion**: Model saved to Bedrock, metadata to S3

**Hyperparameters explained:**

- **Epochs**: Number of times to iterate over the entire training set (1-5)
  - More epochs = more learning, but risk of overfitting
  - Start with 3, adjust based on metrics

- **Learning Rate**: How much to adjust weights during training
  - Higher = faster learning, but less stable
  - Lower = slower, but more precise
  - Default: `0.00001` (conservative)

- **Batch Size**: Number of examples processed together
  - Larger = more stable gradient updates, more memory
  - Smaller = noisier updates, less memory
  - Default: `8`

**Output:**

```
Job ARN: arn:aws:bedrock:us-east-1:ACCOUNT:model-customization-job/JOB_ID
```

#### Watch Job Progress

Monitor training in real-time:

```bash
pnpm tsx src/cli.ts job watch <job-arn>
```

**Output:**

```
[12:00:00] Status: InProgress
  Training Loss: 0.234

[12:30:00] Status: InProgress
  Training Loss: 0.189
  Validation Loss: 0.201

[13:00:00] Status: Completed
  Training Loss: 0.156
  Validation Loss: 0.168
```

Default polling interval: 30 seconds (use `--interval` to change)

#### Check Job Status

One-time status check:

```bash
pnpm tsx src/cli.ts job status <job-arn>
```

#### List All Jobs

```bash
# List jobs from AWS Bedrock
pnpm tsx src/cli.ts job list

# List locally tracked jobs
pnpm tsx src/cli.ts job list --local
```

#### Stop Job

```bash
pnpm tsx src/cli.ts job stop <job-arn>
```

#### List Models

Get a list of available Bedrock models for fine-tuning:

```bash
# List all Bedrock models
pnpm tsx src/cli.ts model list
```

Or only those that support distillation:

```bash
# List models available for distillation
pnpm tsx src/cli.ts model list --distillation
```

### Model Commands

#### Export Model Config

Generate TypeScript config that can later be used in the Polychat API:

```bash
pnpm tsx src/cli.ts model export <model-arn> \
  --name strudel-nova-pro \
  --output ../api/src/data-model/models/custom/strudel.ts
```

**Generates:**

```typescript
export const strudel_nova_proModel: ModelDefinition = {
	id: "strudel-nova-pro",
	name: "Strudel Nova Pro",
	provider: "bedrock",
	providerId: "arn:aws:bedrock:...",
	capabilities: { chat: true, streaming: true, tools: true },
	pricing: { input: 0.0008, output: 0.0032 },
	context: 300000,
	tags: ["custom", "fine-tuned", "strudel", "nova"],
};
```

### Model Deployment

After training has completed you can deploy the fine-tuned model for inference in two ways:

1. **Provisioned Throughput** (Traditional approach):
   - Purchase dedicated model units in AWS Console
   - $78/month per unit (committed pricing)
   - Required for consistent low-latency inference

2. **On-Demand Inference** (New as of April 2025):
   - Pay-per-token pricing
   - No upfront commitment
   - Slightly higher latency

## Cost Estimation

### Fine-Tuning Costs

**Amazon Nova Pro (us-east-1):**

- Training: ~$0.008 per 1K tokens
- For 300 examples × 500 tokens avg = 150K tokens
- 3 epochs = 450K tokens total
- **Estimated cost: $3.60**

**Amazon Nova Lite:**

- Training: ~$0.004 per 1K tokens
- Same dataset: **$1.80**

**Amazon Nova Micro:**

- Training: ~$0.002 per 1K tokens
- Same dataset: **$0.90**

### Storage Costs

**S3 Standard:**

- $0.023 per GB/month
- Datasets are typically <10 MB
- **Negligible cost**

### Inference Costs

**Provisioned Throughput:**

- 1 model unit = $78/month (us-east-1)
- Minimum commitment: 1 hour (~$0.10)
- Recommended for production

**On-Demand Inference (New as of April 2025):**

- Pay per token (pricing similar to base model + premium)
- No commitment
- Higher latency than provisioned

### API Costs (Dataset Generation)

Calling your API 300 times will incur costs from the underlying model:

**Using Claude Sonnet 4:**

- Input: ~100 tokens/request × 300 = 30K tokens × $0.003 = $0.09
- Output: ~500 tokens/request × 300 = 150K tokens × $0.015 = $2.25
- **Total: ~$2.34**

### Distillation Costs

**Distillation Training:**

Model distillation costs include both the student model training and teacher model inference:

- Student training (Nova Lite): ~$0.002 per 1K tokens
- Teacher inference (Claude 3.5 Sonnet): ~$0.003 input + $0.015 output per 1K tokens
- For 300 prompts with teacher generation: ~$2.25 (teacher) + ~$1.00 (student training)
- **Total distillation cost: ~$3.25**

**Cost Comparison:**

| Approach                 | Training Cost | Inference Cost (1M tokens) | Total    |
| ------------------------ | ------------- | -------------------------- | -------- |
| **Fine-tuned Nova Pro**  | ~$3.60        | ~$800                      | ~$803.60 |
| **Distilled Nova Lite**  | ~$3.25        | ~$200                      | ~$203.25 |
| **Distilled Nova Micro** | ~$2.50        | ~$100                      | ~$102.50 |

**Total project cost (Fine-Tuning):**

- Dataset generation: ~$2.34
- Fine-tuning: ~$3.60
- Testing (1 hour provisioned): ~$0.10
- **Grand total: ~$6.00**

**Total project cost (Distillation):**

- Dataset generation: ~$2.34
- Distillation: ~$3.25
- Testing (1 hour provisioned): ~$0.10
- **Grand total: ~$5.70**
