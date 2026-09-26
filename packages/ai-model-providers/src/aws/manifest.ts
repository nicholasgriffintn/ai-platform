import type {
  HardwareOption,
  HostManifest,
  ProviderManifest,
  RegionOption,
  TrainerManifest,
} from "@ngriffin_uk/polychat-schemas";

export const AWS_REGIONS: RegionOption[] = [
  { id: "eu-west-2", label: "London", jurisdiction: "uk" },
  { id: "eu-west-1", label: "Ireland", jurisdiction: "eu" },
  { id: "eu-central-1", label: "Frankfurt", jurisdiction: "eu" },
  { id: "us-east-1", label: "N. Virginia", jurisdiction: "us" },
  { id: "us-west-2", label: "Oregon", jurisdiction: "us" },
  { id: "ap-southeast-2", label: "Sydney", jurisdiction: "apac" },
];

export const BEDROCK_IMPORT_REGIONS = AWS_REGIONS.filter((region) =>
  ["us-east-1", "us-west-2", "eu-central-1"].includes(region.id),
);

export const SAGEMAKER_INSTANCES: HardwareOption[] = [
  {
    id: "ml.g6.xlarge",
    label: "ml.g6.xlarge · L4 (24 GB)",
    accelerator: "nvidia-l4",
    count: 1,
    memoryGb: 24,
    hourlyUsd: 1.01,
  },
  {
    id: "ml.g5.2xlarge",
    label: "ml.g5.2xlarge · A10G (24 GB)",
    accelerator: "nvidia-a10g",
    count: 1,
    memoryGb: 24,
    hourlyUsd: 1.52,
  },
  {
    id: "ml.g6e.xlarge",
    label: "ml.g6e.xlarge · L40S (48 GB)",
    accelerator: "nvidia-l40s",
    count: 1,
    memoryGb: 48,
    hourlyUsd: 2.24,
  },
  {
    id: "ml.g5.12xlarge",
    label: "ml.g5.12xlarge · 4× A10G (96 GB)",
    accelerator: "nvidia-a10g",
    count: 4,
    memoryGb: 96,
    hourlyUsd: 7.09,
  },
  {
    id: "ml.g6e.12xlarge",
    label: "ml.g6e.12xlarge · 4× L40S (192 GB)",
    accelerator: "nvidia-l40s",
    count: 4,
    memoryGb: 192,
    hourlyUsd: 13.12,
  },
  {
    id: "ml.p4d.24xlarge",
    label: "ml.p4d.24xlarge · 8× A100 (320 GB)",
    accelerator: "nvidia-a100",
    count: 8,
    memoryGb: 320,
    hourlyUsd: 37.69,
  },
  {
    id: "ml.p5.48xlarge",
    label: "ml.p5.48xlarge · 8× H100 (640 GB)",
    accelerator: "nvidia-h100",
    count: 8,
    memoryGb: 640,
    hourlyUsd: 98.32,
  },
];

export const BEDROCK_CUSTOMISABLE_BASES: Record<string, string> = {
  "meta-llama/Llama-3.1-8B-Instruct": "meta.llama3-1-8b-instruct-v1:0:128k",
  "meta-llama/Llama-3.1-70B-Instruct": "meta.llama3-1-70b-instruct-v1:0:128k",
  "meta-llama/Llama-3.2-1B-Instruct": "meta.llama3-2-1b-instruct-v1:0:128k",
  "meta-llama/Llama-3.2-3B-Instruct": "meta.llama3-2-3b-instruct-v1:0:128k",
  "meta-llama/Llama-3.2-11B-Vision-Instruct": "meta.llama3-2-11b-instruct-v1:0:128k",
  "openai/gpt-oss-20b": "openai.gpt-oss-20b-1:0",
  "Qwen/Qwen3-32B": "qwen.qwen3-32b-v1:0",
};

export const BEDROCK_IMPORT_ARCHITECTURES = [
  "llama",
  "mistral",
  "mixtral",
  "qwen2",
  "qwen2_5_vl",
  "qwen3",
  "t5",
];

export const BEDROCK_TRAINER: TrainerManifest = {
  id: "bedrock-customisation",
  name: "Bedrock model customisation",
  description:
    "Managed fine-tuning of Bedrock's customisable open models; the result stays in your AWS account and serves on demand.",
  methods: ["sft", "distillation"],
  adaptations: ["lora"],
  datasetShapes: ["messages"],
  graderKinds: [],
  bases: {
    kind: "catalogue",
    models: Object.keys(BEDROCK_CUSTOMISABLE_BASES),
    maxParameters: null,
  },
  hardware: [],
  regions: BEDROCK_IMPORT_REGIONS,
  output: "provider",
  pricing: { unit: "million_tokens", usd: null, note: "Priced per token processed in training" },
};

export const SAGEMAKER_TRAINER: TrainerManifest = {
  id: "sagemaker-training",
  name: "SageMaker training job",
  description:
    "Runs the Polychat TRL recipe in your AWS account; weights land uncompressed in your bucket for SageMaker or Bedrock hosting.",
  methods: [
    "sft",
    "dpo",
    "rft",
    "distillation",
    "continued_pretraining",
    "embedding",
    "merge",
    "quantise",
  ],
  adaptations: ["lora", "qlora", "full"],
  datasetShapes: ["messages", "preference", "prompt_grader", "text", "retrieval"],
  graderKinds: ["exact", "contains", "regex", "json_schema", "numeric"],
  bases: { kind: "hub", models: ["*"], maxParameters: null },
  hardware: SAGEMAKER_INSTANCES,
  regions: AWS_REGIONS,
  output: "provider",
  pricing: {
    unit: "gpu_hour",
    usd: null,
    note: "Billable seconds at the instance's on-demand rate",
  },
};

export const BEDROCK_HOST: HostManifest = {
  id: "bedrock",
  name: "Bedrock on demand",
  description:
    "Custom Model Import for Hub or S3 weights, or on-demand deployment of a Bedrock fine-tune, billed per token with no instances to manage.",
  shapes: ["serverless"],
  weights: "hub",
  adapters: false,
  scaleToZero: true,
  weightsVerified: true,
  retention: "zero",
  engines: ["provider"],
  quantisations: ["none"],
  hardware: [],
  regions: BEDROCK_IMPORT_REGIONS,
  architectures: BEDROCK_IMPORT_ARCHITECTURES,
  maxParameters: 90e9,
  pricing: {
    unit: "million_tokens",
    usd: null,
    note: "Custom model units billed per five-minute window while active",
  },
};

export const SAGEMAKER_HOST: HostManifest = {
  id: "sagemaker",
  name: "SageMaker endpoint",
  description: "Dedicated vLLM endpoint in your AWS account and VPC, loading Hub or S3 weights.",
  shapes: ["dedicated"],
  weights: "hub",
  adapters: false,
  scaleToZero: false,
  weightsVerified: true,
  retention: "self",
  engines: ["vllm"],
  quantisations: ["none", "fp8", "awq", "gptq"],
  hardware: SAGEMAKER_INSTANCES,
  regions: AWS_REGIONS,
  architectures: ["*"],
  maxParameters: null,
  pricing: { unit: "gpu_hour", usd: null, note: "Instance hours while the endpoint exists" },
};

export const AWS_MANIFEST: ProviderManifest = {
  id: "aws",
  name: "Amazon Web Services",
  vendor: "AWS",
  description:
    "Bedrock and SageMaker in your own account: fine-tune, import and serve models with data kept in your S3 bucket.",
  docsUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/model-customization.html",
  connection: {
    fields: [
      { key: "accessKeyId", label: "Access key ID", kind: "secret", required: true },
      { key: "secretAccessKey", label: "Secret access key", kind: "secret", required: true },
      { key: "sessionToken", label: "Session token", kind: "secret", required: false },
      {
        key: "region",
        label: "Region",
        kind: "select",
        required: true,
        options: AWS_REGIONS.map((region) => ({
          value: region.id,
          label: `${region.label} (${region.id})`,
        })),
      },
      {
        key: "bucket",
        label: "Working bucket",
        kind: "text",
        required: true,
        help: "Training data, staged weights and job outputs are written under polychat/ in this bucket.",
      },
      {
        key: "roleArn",
        label: "Execution role ARN",
        kind: "text",
        required: true,
        help: "A role SageMaker and Bedrock can assume to read and write the bucket.",
      },
    ],
  },
  source: true,
  store: { id: "s3", name: "S3 bucket", versioned: false },
  trainers: [BEDROCK_TRAINER, SAGEMAKER_TRAINER],
  hosts: [BEDROCK_HOST, SAGEMAKER_HOST],
};
