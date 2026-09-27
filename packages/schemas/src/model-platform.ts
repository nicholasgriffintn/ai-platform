import z from "zod/v4";

import { workspaceAuditRecordSchema } from "./audit.js";
import {
  modelDecisionSchema,
  modelRouteSchema,
  modificationComputeSchema,
  policyVerdictSchema,
  registryWorkspaceParamsSchema,
} from "./model-registry.js";

export const MODEL_PROVIDER_IDS = [
  "huggingface",
  "aws",
  "together",
  "fireworks",
  "nebius",
  "google-vertex",
  "azure-foundry",
  "runpod",
  "cloudflare-workers-ai",
  "openai-compatible",
] as const;
export const modelProviderIdSchema = z.enum(MODEL_PROVIDER_IDS);
export type ModelProviderId = z.infer<typeof modelProviderIdSchema>;

export const JURISDICTIONS = ["eu", "uk", "us", "ca", "apac", "me", "global"] as const;
export const jurisdictionSchema = z.enum(JURISDICTIONS);
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;

export const TRAINING_METHODS = [
  "sft",
  "dpo",
  "rft",
  "distillation",
  "continued_pretraining",
  "embedding",
  "vision_sft",
  "merge",
  "quantise",
] as const;
export const trainingMethodSchema = z.enum(TRAINING_METHODS);
export type TrainingMethod = z.infer<typeof trainingMethodSchema>;

export const ADAPTATIONS = ["lora", "qlora", "full"] as const;
export const adaptationSchema = z.enum(ADAPTATIONS);
export type Adaptation = z.infer<typeof adaptationSchema>;

export const DATASET_SHAPES = [
  "messages",
  "preference",
  "prompt_grader",
  "text",
  "retrieval",
  "image_text",
  "audio_text",
] as const;
export const datasetShapeSchema = z.enum(DATASET_SHAPES);
export type DatasetShape = z.infer<typeof datasetShapeSchema>;

export const DEPLOYMENT_SHAPES = ["serverless", "dedicated", "adapter_pool", "external"] as const;
export const deploymentShapeSchema = z.enum(DEPLOYMENT_SHAPES);
export type DeploymentShape = z.infer<typeof deploymentShapeSchema>;

export const SERVING_ENGINES = [
  "vllm",
  "sglang",
  "tgi",
  "tensorrt-llm",
  "llama.cpp",
  "provider",
] as const;
export const servingEngineSchema = z.enum(SERVING_ENGINES);
export type ServingEngine = z.infer<typeof servingEngineSchema>;

export const QUANTISATIONS = ["none", "fp8", "awq", "gptq", "nvfp4", "bnb-4bit", "gguf"] as const;
export const quantisationSchema = z.enum(QUANTISATIONS);
export type Quantisation = z.infer<typeof quantisationSchema>;

export const GRADER_KINDS = [
  "exact",
  "contains",
  "regex",
  "json_schema",
  "numeric",
  "judge",
] as const;
export const graderKindSchema = z.enum(GRADER_KINDS);
export type GraderKind = z.infer<typeof graderKindSchema>;

export const hardwareOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  accelerator: z.string(),
  count: z.number().int().nonnegative(),
  memoryGb: z.number().nonnegative(),
  hourlyUsd: z.number().nonnegative().nullable(),
});
export type HardwareOption = z.infer<typeof hardwareOptionSchema>;

export const regionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  jurisdiction: jurisdictionSchema,
});
export type RegionOption = z.infer<typeof regionOptionSchema>;

export const connectionFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["secret", "text", "select"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});
export type ConnectionField = z.infer<typeof connectionFieldSchema>;

export const trainerManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  methods: z.array(trainingMethodSchema),
  adaptations: z.array(adaptationSchema),
  datasetShapes: z.array(datasetShapeSchema),
  graderKinds: z.array(graderKindSchema),
  bases: z.object({
    kind: z.enum(["hub", "catalogue"]),
    models: z.array(z.string()),
    maxParameters: z.number().positive().nullable(),
  }),
  hardware: z.array(hardwareOptionSchema),
  regions: z.array(regionOptionSchema),
  output: z.enum(["hub", "provider"]),
  pricing: z.object({
    unit: z.enum(["gpu_hour", "million_tokens"]),
    usd: z.number().nonnegative().nullable(),
    note: z.string(),
  }),
});
export type TrainerManifest = z.infer<typeof trainerManifestSchema>;

export const hostManifestSchema = z.object({
  id: z.string(),
  pauseSupported: z.boolean().optional(),
  name: z.string(),
  description: z.string(),
  shapes: z.array(deploymentShapeSchema),
  weights: z.enum(["hub", "provider", "catalogue", "external"]),
  adapters: z.boolean(),
  scaleToZero: z.boolean(),
  weightsVerified: z.boolean(),
  retention: z.enum(["zero", "provider", "self"]),
  engines: z.array(servingEngineSchema),
  quantisations: z.array(quantisationSchema),
  hardware: z.array(hardwareOptionSchema),
  regions: z.array(regionOptionSchema),
  architectures: z.array(z.string()),
  maxParameters: z.number().positive().nullable(),
  pricing: z.object({
    unit: z.enum(["gpu_hour", "million_tokens", "request"]),
    usd: z.number().nonnegative().nullable(),
    note: z.string(),
  }),
});
export type HostManifest = z.infer<typeof hostManifestSchema>;

export const providerManifestSchema = z.object({
  id: modelProviderIdSchema,
  name: z.string(),
  vendor: z.string(),
  description: z.string(),
  docsUrl: z.string(),
  connection: z.object({ fields: z.array(connectionFieldSchema) }),
  source: z.boolean(),
  store: z.object({ id: z.string(), name: z.string(), versioned: z.boolean() }).nullable(),
  trainers: z.array(trainerManifestSchema),
  hosts: z.array(hostManifestSchema),
});
export type ProviderManifest = z.infer<typeof providerManifestSchema>;

export const connectionCapabilitiesSchema = z.object({
  read: z.boolean(),
  store: z.boolean(),
  train: z.boolean(),
  host: z.boolean(),
});
export type ConnectionCapabilities = z.infer<typeof connectionCapabilitiesSchema>;

export const modelConnectionSchema = z.object({
  provider: modelProviderIdSchema,
  account: z.string().nullable(),
  config: z.record(z.string(), z.string()),
  secretKeys: z.array(z.string()),
  capabilities: connectionCapabilitiesSchema,
  updatedAt: z.string(),
  updatedBy: z.number().int().nullable(),
});
export type ModelConnection = z.infer<typeof modelConnectionSchema>;

export const providerCatalogueEntrySchema = z.object({
  manifest: providerManifestSchema,
  connection: modelConnectionSchema.nullable(),
});
export type ProviderCatalogueEntry = z.infer<typeof providerCatalogueEntrySchema>;

export const providerCatalogueResponseSchema = z.object({
  providers: z.array(providerCatalogueEntrySchema),
});
export type ProviderCatalogueResponse = z.infer<typeof providerCatalogueResponseSchema>;

export const saveModelConnectionRequestSchema = z.object({
  secrets: z.record(z.string(), z.string().trim().min(1).max(20_000)).default({}),
  config: z.record(z.string(), z.string().trim().max(500)).default({}),
});
export type SaveModelConnectionRequest = z.infer<typeof saveModelConnectionRequestSchema>;

export const connectionCheckSchema = z.object({
  account: z.string(),
  capabilities: connectionCapabilitiesSchema,
  namespaces: z.array(z.object({ name: z.string(), canWrite: z.boolean() })),
  message: z.string().nullable(),
});
export type ConnectionCheck = z.infer<typeof connectionCheckSchema>;

export const modelConnectionParamsSchema = registryWorkspaceParamsSchema.extend({
  provider: modelProviderIdSchema,
});

export const providerTargetSchema = z.object({
  provider: modelProviderIdSchema,
  target: z.string().min(1).max(64),
  hardware: z.string().min(1).max(80).nullable().default(null),
  region: z.string().min(1).max(64).nullable().default(null),
});
export type ProviderTarget = z.infer<typeof providerTargetSchema>;

export const providerOptionsSchema = z.record(z.string(), z.unknown()).default({});

export const trainingHyperparametersSchema = z.object({
  epochs: z.number().positive().max(50).default(2),
  learningRate: z.number().positive().max(1).nullable().default(null),
  batchSize: z.number().int().positive().max(1024).default(8),
  gradientAccumulation: z.number().int().positive().max(512).default(1),
  maxSequenceLength: z.number().int().positive().max(1_048_576).default(4096),
  warmupRatio: z.number().min(0).max(1).default(0.03),
  weightDecay: z.number().min(0).max(1).default(0),
  seed: z.number().int().nonnegative().default(42),
  packing: z.boolean().default(true),
  earlyStopping: z.boolean().default(false),
  loraRank: z.number().int().positive().max(512).default(16),
  loraAlpha: z.number().int().positive().max(1024).default(32),
  loraDropout: z.number().min(0).max(1).default(0.05),
  dpoBeta: z.number().positive().max(10).default(0.1),
  generationsPerPrompt: z.number().int().positive().max(64).default(8),
});
export type TrainingHyperparameters = z.infer<typeof trainingHyperparametersSchema>;

export const teacherModelSchema = z.object({
  routeId: z.string().min(1),
  sampleCount: z.number().int().positive().max(20_000).default(1000),
});
export type TeacherModel = z.infer<typeof teacherModelSchema>;

export const trainingSpecSchema = z.object({
  method: trainingMethodSchema,
  adaptation: adaptationSchema.default("lora"),
  baseVersionId: z.string().min(1),
  mergeVersionIds: z.array(z.string().min(1)).max(8).default([]),
  trainDatasetVersionId: z.string().min(1).nullable().default(null),
  validationDatasetVersionId: z.string().min(1).nullable().default(null),
  graderId: z.string().min(1).nullable().default(null),
  quantisation: quantisationSchema.default("none"),
  hyperparameters: trainingHyperparametersSchema.default(trainingHyperparametersSchema.parse({})),
  target: providerTargetSchema,
  checkpointEvery: z.number().int().positive().max(100_000).nullable().default(null),
  outputName: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes"),
  providerOptions: providerOptionsSchema,
});
export type TrainingSpec = z.infer<typeof trainingSpecSchema>;
export type TrainingSpecInput = z.input<typeof trainingSpecSchema>;

export const deploymentScalingSchema = z.object({
  minReplicas: z.number().int().nonnegative().max(64).default(0),
  maxReplicas: z.number().int().positive().max(64).default(1),
  scaleToZeroAfterMinutes: z.number().int().positive().max(1440).nullable().default(30),
});
export type DeploymentScaling = z.infer<typeof deploymentScalingSchema>;

export const externalEndpointSchema = z.object({
  baseUrl: z.url().max(500),
  modelId: z.string().min(1).max(200),
});
export type ExternalEndpoint = z.infer<typeof externalEndpointSchema>;

export const deploymentSpecSchema = z.object({
  versionId: z.string().min(1),
  adapterVersionIds: z.array(z.string().min(1)).max(32).default([]),
  shape: deploymentShapeSchema,
  target: providerTargetSchema,
  engine: servingEngineSchema.default("vllm"),
  quantisation: quantisationSchema.default("none"),
  scaling: deploymentScalingSchema.default(deploymentScalingSchema.parse({})),
  access: z.enum(["private", "authenticated", "public"]).default("private"),
  contextLength: z.number().int().positive().max(1_048_576).nullable().default(null),
  maxConcurrency: z.number().int().positive().max(4096).default(8),
  external: externalEndpointSchema.nullable().default(null),
  providerOptions: providerOptionsSchema,
});
export type DeploymentSpec = z.infer<typeof deploymentSpecSchema>;
export type DeploymentSpecInput = z.input<typeof deploymentSpecSchema>;

export const sizingEstimateSchema = z.object({
  parameters: z.number().nonnegative(),
  quantisation: quantisationSchema,
  bytesPerParameter: z.number().positive(),
  weightBytes: z.number().nonnegative(),
  kvBytesPerToken: z.number().nonnegative(),
  contextLength: z.number().int().positive(),
  concurrency: z.number().int().positive(),
  kvBytes: z.number().nonnegative(),
  overheadBytes: z.number().nonnegative(),
  totalBytes: z.number().nonnegative(),
  basis: z.enum(["config", "parameters_only"]),
});
export type SizingEstimate = z.infer<typeof sizingEstimateSchema>;

export const costEstimateSchema = z.object({
  usd: z.number().nonnegative().nullable(),
  low: z.number().nonnegative().nullable(),
  high: z.number().nonnegative().nullable(),
  basis: z.string(),
  gpuHours: z.number().nonnegative().nullable(),
  tokens: z.number().nonnegative().nullable(),
});
export type CostEstimate = z.infer<typeof costEstimateSchema>;

export const spendDecisionSchema = z.enum(["allow", "warn", "needs_approval", "blocked"]);
export type SpendDecision = z.infer<typeof spendDecisionSchema>;

export const spendPreflightSchema = z.object({
  decision: spendDecisionSchema,
  estimateUsd: z.number().nonnegative().nullable(),
  remainingUsd: z.number().nullable(),
  reason: z.string().nullable(),
});
export type SpendPreflight = z.infer<typeof spendPreflightSchema>;

export const deploymentOptionSchema = z.object({
  provider: modelProviderIdSchema,
  providerName: z.string(),
  host: z.string(),
  hostName: z.string(),
  shape: deploymentShapeSchema,
  region: regionOptionSchema.nullable(),
  hardware: hardwareOptionSchema.nullable(),
  fits: z.boolean(),
  reasons: z.array(z.string()),
  hourlyUsd: z.number().nonnegative().nullable(),
  perMillionTokensUsd: z.number().nonnegative().nullable(),
  scaleToZero: z.boolean(),
  weightsVerified: z.boolean(),
  retention: z.enum(["zero", "provider", "self"]),
  connected: z.boolean(),
  verdict: policyVerdictSchema,
  engines: z.array(servingEngineSchema),
  quantisations: z.array(quantisationSchema),
});
export type DeploymentOption = z.infer<typeof deploymentOptionSchema>;

export const deploymentPlanRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  versionId: z.string().min(1),
  adapterVersionIds: z.array(z.string().min(1)).max(32).default([]),
  quantisation: quantisationSchema.default("none"),
  contextLength: z.number().int().positive().max(1_048_576).default(8192),
  concurrency: z.number().int().positive().max(4096).default(8),
});
export type DeploymentPlanRequest = z.input<typeof deploymentPlanRequestSchema>;

export const deploymentPlanSchema = z.object({
  sizing: sizingEstimateSchema.nullable(),
  options: z.array(deploymentOptionSchema),
});
export type DeploymentPlan = z.infer<typeof deploymentPlanSchema>;

export const DEPLOYMENT_STATUSES = [
  "pending",
  "provisioning",
  "running",
  "scaled_to_zero",
  "paused",
  "updating",
  "failed",
  "deleting",
  "deleted",
] as const;
export const deploymentStatusSchema = z.enum(DEPLOYMENT_STATUSES);
export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;
export const TRANSITIONAL_DEPLOYMENT_STATUSES: readonly DeploymentStatus[] = [
  "pending",
  "provisioning",
  "updating",
  "deleting",
];

export const modelDeploymentSchema = z.object({
  id: z.string(),
  pauseSupported: z.boolean().optional(),
  spendRequestId: z.string().optional(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  name: z.string(),
  spec: deploymentSpecSchema,
  specHash: z.string(),
  status: deploymentStatusSchema,
  provider: modelProviderIdSchema,
  host: z.string(),
  providerRef: z.string().nullable(),
  region: z.string().nullable(),
  jurisdiction: jurisdictionSchema.nullable(),
  weightsVerified: z.boolean(),
  routeId: z.string().nullable(),
  hourlyUsd: z.number().nonnegative().nullable(),
  failureReason: z.string().nullable(),
  createdBy: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCheckedAt: z.string().nullable(),
});
export type ModelDeployment = z.infer<typeof modelDeploymentSchema>;

export const createDeploymentRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  name: z
    .string()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes"),
  spec: deploymentSpecSchema,
  aliasName: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
});
export type CreateDeploymentRequest = z.input<typeof createDeploymentRequestSchema>;

export const scaleDeploymentRequestSchema = z.object({
  minReplicas: z.number().int().nonnegative().max(64),
  maxReplicas: z.number().int().positive().max(64),
});
export type ScaleDeploymentRequest = z.infer<typeof scaleDeploymentRequestSchema>;

export const deploymentSpendActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resume"), deploymentId: z.string().min(1), specHash: z.string() }),
  z.object({
    action: z.literal("scale"),
    deploymentId: z.string().min(1),
    specHash: z.string(),
    scaling: scaleDeploymentRequestSchema,
  }),
]);
export type DeploymentSpendAction = z.infer<typeof deploymentSpendActionSchema>;

export const deploymentActionSchema = z.enum(["pause", "resume", "delete"]);
export type DeploymentAction = z.infer<typeof deploymentActionSchema>;

export const playgroundMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(100_000),
});
export type PlaygroundMessage = z.infer<typeof playgroundMessageSchema>;

export const playgroundRequestSchema = z.object({
  messages: z.array(playgroundMessageSchema).min(1).max(50),
  maxTokens: z.number().int().positive().max(8192).default(512),
  temperature: z.number().min(0).max(2).default(0.7),
});
export type PlaygroundRequest = z.input<typeof playgroundRequestSchema>;

export const playgroundResponseSchema = z.object({
  output: z.string(),
  latencyMs: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});
export type PlaygroundResponse = z.infer<typeof playgroundResponseSchema>;

export const deploymentsResponseSchema = z.object({
  deployments: z.array(modelDeploymentSchema.extend({ displayName: z.string() })),
});
export type DeploymentsResponse = z.infer<typeof deploymentsResponseSchema>;

export const modelDeploymentParamsSchema = registryWorkspaceParamsSchema.extend({
  deploymentId: z.string().min(1),
});
export const modelDeploymentActionParamsSchema = modelDeploymentParamsSchema.extend({
  action: deploymentActionSchema,
});

export const aliasGateSchema = z.object({
  suiteId: z.string().min(1),
  thresholds: z.record(z.string(), z.number().min(0).max(1)),
});
export type AliasGate = z.infer<typeof aliasGateSchema>;

export const modelAliasSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  routeId: z.string().nullable(),
  canaryRouteId: z.string().nullable(),
  canaryPercent: z.number().int().min(0).max(100),
  gate: aliasGateSchema.nullable(),
  requiresApproval: z.boolean(),
  chatModelId: z.string(),
  updatedAt: z.string(),
  updatedBy: z.number().int().nullable(),
});
export type ModelAlias = z.infer<typeof modelAliasSchema>;

export const deploymentDetailSchema = z.object({
  deployment: modelDeploymentSchema,
  route: modelRouteSchema.nullable(),
  aliases: z.array(modelAliasSchema),
  displayName: z.string(),
  health: z.object({
    requests: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
  }),
  spendUsd: z.number().nonnegative(),
});
export type DeploymentDetail = z.infer<typeof deploymentDetailSchema>;

export const ALIAS_EVENT_KINDS = [
  "created",
  "promoted",
  "rolled_back",
  "canary_started",
  "canary_ended",
  "requested",
  "revoked",
] as const;

export const aliasEventSchema = z.object({
  id: z.string(),
  aliasId: z.string(),
  kind: z.enum(ALIAS_EVENT_KINDS),
  fromRouteId: z.string().nullable(),
  toRouteId: z.string().nullable(),
  reason: z.string().nullable(),
  gate: z
    .object({
      passed: z.boolean(),
      scores: z.record(z.string(), z.number()),
      failures: z.array(z.string()),
      runId: z.string().nullable(),
    })
    .nullable(),
  actorUserId: z.number().int().nullable(),
  createdAt: z.string(),
});
export type AliasEvent = z.infer<typeof aliasEventSchema>;

export const aliasNameSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes");

export const createAliasRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  name: aliasNameSchema,
  description: z.string().max(500).optional(),
  routeId: z.string().min(1).nullable().default(null),
  gate: aliasGateSchema.nullable().default(null),
  requiresApproval: z.boolean().default(false),
});
export type CreateAliasRequest = z.input<typeof createAliasRequestSchema>;

export const updateAliasRequestSchema = z.object({
  description: z.string().max(500).nullable().optional(),
  gate: aliasGateSchema.nullable().optional(),
  requiresApproval: z.boolean().optional(),
});
export type UpdateAliasRequest = z.infer<typeof updateAliasRequestSchema>;

export const promoteAliasRequestSchema = z.object({
  routeId: z.string().min(1),
  reason: z.string().max(500).optional(),
  canaryPercent: z.number().int().min(1).max(99).optional(),
});
export type PromoteAliasRequest = z.infer<typeof promoteAliasRequestSchema>;

export const promotionResultSchema = z.object({
  alias: modelAliasSchema,
  outcome: z.enum(["promoted", "canary_started", "awaiting_approval", "gate_failed"]),
  event: aliasEventSchema,
  decision: modelDecisionSchema.nullable(),
});
export type PromotionResult = z.infer<typeof promotionResultSchema>;

export const aliasDetailSchema = z.object({
  alias: modelAliasSchema,
  events: z.array(aliasEventSchema),
  route: modelRouteSchema.nullable(),
  canaryRoute: modelRouteSchema.nullable(),
});
export type AliasDetail = z.infer<typeof aliasDetailSchema>;

export const aliasesResponseSchema = z.object({
  aliases: z.array(modelAliasSchema.extend({ targetName: z.string().nullable() })),
});
export type AliasesResponse = z.infer<typeof aliasesResponseSchema>;

export const modelAliasParamsSchema = registryWorkspaceParamsSchema.extend({
  aliasId: z.string().min(1),
});

export const graderConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact") }),
  z.object({ kind: z.literal("contains") }),
  z.object({ kind: z.literal("regex"), pattern: z.string().min(1).max(500) }),
  z.object({
    kind: z.literal("json_schema"),
    requiredKeys: z.array(z.string().min(1).max(100)).max(50).default([]),
  }),
  z.object({ kind: z.literal("numeric"), tolerance: z.number().nonnegative().max(1e9) }),
  z.object({
    kind: z.literal("judge"),
    rubric: z.string().min(1).max(8000),
    judgeModelId: z.string().min(1).max(200).nullable().default(null),
  }),
]);
export type GraderConfig = z.infer<typeof graderConfigSchema>;

export const graderSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  name: z.string(),
  metric: z.string(),
  description: z.string().nullable(),
  config: graderConfigSchema,
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Grader = z.infer<typeof graderSchema>;

export const graderMetricSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores");

export const createGraderRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  name: z.string().min(1).max(120),
  metric: graderMetricSchema,
  description: z.string().max(1000).optional(),
  config: graderConfigSchema,
});
export type CreateGraderRequest = z.input<typeof createGraderRequestSchema>;

export const gradersResponseSchema = z.object({ graders: z.array(graderSchema) });

export const graderPreviewRequestSchema = z.object({
  output: z.string().max(100_000),
  expected: z.string().max(100_000).optional(),
});
export const graderPreviewSchema = z.object({ score: z.number().min(0).max(1).nullable() });

export const modelGraderParamsSchema = registryWorkspaceParamsSchema.extend({
  graderId: z.string().min(1),
});

export const DATASET_COLLECTION_METHODS = [
  "upload",
  "hub",
  "bucket",
  "conversations",
  "synthetic",
] as const;
export const datasetCollectionMethodSchema = z.enum(DATASET_COLLECTION_METHODS);

export const LAWFUL_BASES = [
  "not_personal_data",
  "consent",
  "contract",
  "legitimate_interests",
  "legal_obligation",
  "unknown",
] as const;
export const lawfulBasisSchema = z.enum(LAWFUL_BASES);
export type LawfulBasis = z.infer<typeof lawfulBasisSchema>;

export const datasetGovernanceSchema = z.object({
  licence: z.string().min(1).max(100),
  lawfulBasis: lawfulBasisSchema,
  personalDataCategories: z.array(z.string().min(1).max(60)).max(20).default([]),
  containsCustomerData: z.boolean().default(false),
  retentionDays: z.number().int().positive().max(3650).nullable().default(null),
  intendedUse: z.string().max(1000).default(""),
});
export type DatasetGovernance = z.infer<typeof datasetGovernanceSchema>;

export const DATASET_ROLES = [
  "messages",
  "system",
  "prompt",
  "response",
  "chosen",
  "rejected",
  "reference",
  "text",
  "query",
  "positive",
  "negative",
  "image",
  "audio",
] as const;
export const datasetRoleSchema = z.enum(DATASET_ROLES);
export type DatasetRole = z.infer<typeof datasetRoleSchema>;

export const datasetMappingSchema = z.object({
  shape: datasetShapeSchema,
  columns: z.partialRecord(datasetRoleSchema, z.string().min(1).max(200)),
});
export type DatasetMapping = z.infer<typeof datasetMappingSchema>;

export const DATASET_SPLITS = ["train", "validation", "test"] as const;
export const datasetSplitSchema = z.enum(DATASET_SPLITS);
export type DatasetSplit = z.infer<typeof datasetSplitSchema>;

export const datasetSplitPlanSchema = z.object({
  validation: z.number().min(0).max(0.5).default(0.05),
  test: z.number().min(0).max(0.5).default(0),
  seed: z.number().int().nonnegative().default(42),
});
export type DatasetSplitPlan = z.infer<typeof datasetSplitPlanSchema>;

export const datasetProcessingOptionsSchema = z.object({
  redactPii: z.boolean().default(true),
  dedupe: z.boolean().default(true),
  decontaminateSuiteIds: z.array(z.string().min(1)).max(20).default([]),
  maxRows: z.number().int().positive().max(2_000_000).nullable().default(null),
  tokenizerVersionId: z.string().min(1).nullable().default(null),
});
export type DatasetProcessingOptions = z.infer<typeof datasetProcessingOptionsSchema>;

const datasetCommonSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  name: z.string().min(1).max(120),
  mapping: datasetMappingSchema,
  governance: datasetGovernanceSchema,
  split: datasetSplitPlanSchema.default(datasetSplitPlanSchema.parse({})),
  processing: datasetProcessingOptionsSchema.default(datasetProcessingOptionsSchema.parse({})),
});

export const conversationDatasetFiltersSchema = z.object({
  minFeedbackRating: z.number().int().min(1).max(5).nullable().default(4),
  minQualityScore: z.number().min(0).max(10).nullable().default(null),
  since: z.string().nullable().default(null),
  limit: z.number().int().positive().max(50_000).default(5000),
});
export type ConversationDatasetFilters = z.infer<typeof conversationDatasetFiltersSchema>;

export const createDatasetRequestSchema = z.discriminatedUnion("source", [
  datasetCommonSchema.extend({ source: z.literal("upload"), uploadId: z.string().min(1) }),
  datasetCommonSchema.extend({
    source: z.literal("hub"),
    repo: z
      .string()
      .min(3)
      .max(200)
      .regex(/^[A-Za-z0-9][\w.-]*\/[\w.-]+$/, "Use the owner/name form"),
    revision: z
      .string()
      .regex(/^[\w./-]{1,120}$/)
      .optional(),
    config: z.string().max(120).optional(),
    split: datasetSplitPlanSchema.default(datasetSplitPlanSchema.parse({})),
    hubSplit: z.string().max(120).default("train"),
  }),
  datasetCommonSchema.extend({
    source: z.literal("bucket"),
    provider: z.literal("aws"),
    uri: z.string().regex(/^s3:\/\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\/.+$/, "Use s3://bucket/key"),
  }),
  datasetCommonSchema.extend({
    source: z.literal("conversations"),
    filters: conversationDatasetFiltersSchema.default(conversationDatasetFiltersSchema.parse({})),
  }),
  datasetCommonSchema.extend({
    source: z.literal("synthetic"),
    teacher: teacherModelSchema,
    seedPrompts: z.array(z.string().min(1).max(8000)).min(1).max(500),
    instructions: z.string().max(8000).default(""),
  }),
]);
export type CreateDatasetRequest = z.input<typeof createDatasetRequestSchema>;

export const datasetProfileSchema = z.object({
  versionId: z.string(),
  status: z.enum(["processing", "ready", "failed"]),
  shape: datasetShapeSchema,
  mapping: datasetMappingSchema,
  governance: datasetGovernanceSchema,
  collectionMethod: datasetCollectionMethodSchema,
  rows: z.number().int().nonnegative(),
  tokens: z.number().int().nonnegative(),
  meanTokens: z.number().nonnegative(),
  p95Tokens: z.number().nonnegative(),
  maxTokens: z.number().nonnegative(),
  duplicatesRemoved: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  flaggedRows: z.number().int().nonnegative(),
  decontaminatedRows: z.number().int().nonnegative(),
  languages: z.record(z.string(), z.number().int().nonnegative()),
  piiBefore: z.record(z.string(), z.number().int().nonnegative()),
  piiAfter: z.record(z.string(), z.number().int().nonnegative()),
  lengthHistogram: z.array(z.object({ upTo: z.number(), rows: z.number().int() })),
  splits: z.array(
    z.object({
      name: datasetSplitSchema,
      rows: z.number().int().nonnegative(),
      tokens: z.number().int().nonnegative(),
    }),
  ),
  sourceRef: z.string(),
  failureReason: z.string().nullable(),
  processedAt: z.string().nullable(),
});
export type DatasetProfile = z.infer<typeof datasetProfileSchema>;

export interface DatasetStats extends Partial<DatasetProfile> {
  flaggedIndexes?: Record<DatasetSplit, number[]>;
  generated?: number;
  sourceRevision?: string;
}

export const datasetRowSchema = z.object({
  index: z.number().int().nonnegative(),
  split: datasetSplitSchema,
  flags: z.array(z.string()),
  record: z.record(z.string(), z.unknown()),
});
export type DatasetRow = z.infer<typeof datasetRowSchema>;

export const datasetRowsQuerySchema = z.object({
  split: datasetSplitSchema.default("train"),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(25),
  flaggedOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
});
export type DatasetRowsQuery = z.infer<typeof datasetRowsQuerySchema>;

export const datasetRowsResponseSchema = z.object({
  rows: z.array(datasetRowSchema),
  total: z.number().int().nonnegative(),
});
export type DatasetRowsResponse = z.infer<typeof datasetRowsResponseSchema>;

export const excludeDatasetRowsRequestSchema = z.object({
  split: datasetSplitSchema,
  indexes: z.array(z.number().int().nonnegative()).min(1).max(10_000),
  reason: z.string().min(1).max(500),
});
export type ExcludeDatasetRowsRequest = z.infer<typeof excludeDatasetRowsRequestSchema>;

export const erasureRequestSchema = z.object({
  split: datasetSplitSchema,
  indexes: z.array(z.number().int().nonnegative()).min(1).max(10_000),
  reason: z.string().min(1).max(500),
  action: z.enum(["retrain_by", "withdraw"]),
  dueInDays: z.number().int().positive().max(365).default(30),
});
export type ErasureRequest = z.infer<typeof erasureRequestSchema>;

export const erasureResultSchema = z.object({
  datasetVersionId: z.string(),
  affectedVersionIds: z.array(z.string()),
  affectedRouteIds: z.array(z.string()),
  action: z.enum(["retrain_by", "withdraw"]),
  dueAt: z.string(),
});
export type ErasureResult = z.infer<typeof erasureResultSchema>;

export const datasetSummarySchema = z.object({
  assetId: z.string(),
  versionId: z.string(),
  name: z.string(),
  revision: z.string(),
  profile: datasetProfileSchema.nullable(),
  verdict: policyVerdictSchema,
  usable: z.boolean(),
  createdAt: z.string(),
  usedBy: z.number().int().nonnegative(),
});
export type DatasetSummary = z.infer<typeof datasetSummarySchema>;

export const datasetsResponseSchema = z.object({ datasets: z.array(datasetSummarySchema) });

export const datasetDetailSchema = datasetSummarySchema.extend({
  versions: z.array(z.object({ id: z.string(), revision: z.string(), createdAt: z.string() })),
  derivedFrom: z.array(z.string()),
  usedByVersionIds: z.array(z.string()),
});
export type DatasetDetail = z.infer<typeof datasetDetailSchema>;

export const modelDatasetParamsSchema = registryWorkspaceParamsSchema.extend({
  versionId: z.string().min(1),
});

export const UPLOAD_PURPOSES = ["model", "adapter", "dataset"] as const;
export const uploadPurposeSchema = z.enum(UPLOAD_PURPOSES);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

export const UPLOAD_PART_BYTES = 50 * 1024 * 1024;
export const MAX_DATASET_UPLOAD_BYTES = 512 * 1024 * 1024;
export const MAX_WEIGHT_UPLOAD_BYTES = 200 * 1024 * 1024 * 1024;

export const uploadFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(300)
    .regex(/^(?!\/)(?!.*\.\.)[\w./-]+$/, "Use a relative path without .."),
  size: z.number().int().positive().max(MAX_WEIGHT_UPLOAD_BYTES),
});

export const createUploadRequestSchema = z.object({
  purpose: uploadPurposeSchema,
  name: z.string().min(1).max(120),
  files: z.array(uploadFileInputSchema).min(1).max(200),
});
export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;

export const uploadFileSchema = z.object({
  index: z.number().int().nonnegative(),
  path: z.string(),
  size: z.number().int().nonnegative(),
  partCount: z.number().int().positive(),
  partsUploaded: z.array(z.number().int().positive()),
  sha256: z.string().nullable(),
});
export type UploadFile = z.infer<typeof uploadFileSchema>;

export const uploadSessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  purpose: uploadPurposeSchema,
  name: z.string(),
  status: z.enum(["uploading", "hashing", "ready", "failed", "aborted"]),
  files: z.array(uploadFileSchema),
  partBytes: z.number().int().positive(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
});
export type UploadSession = z.infer<typeof uploadSessionSchema>;

export const modelUploadParamsSchema = registryWorkspaceParamsSchema.extend({
  uploadId: z.string().min(1),
});
export const modelUploadPartParamsSchema = modelUploadParamsSchema.extend({
  fileIndex: z.coerce.number().int().nonnegative(),
  partNumber: z.coerce.number().int().positive().max(10_000),
});

export const registerUploadedModelRequestSchema = z.object({
  uploadId: z.string().min(1),
  projectId: z.string().min(1).nullable().default(null),
  kind: z.enum(["model", "adapter"]),
  baseVersionId: z.string().min(1).nullable().default(null),
  licence: z.string().min(1).max(100),
  provenance: z.string().min(1).max(2000),
  intendedUse: z.string().max(1000).default(""),
});
export type RegisterUploadedModelRequest = z.input<typeof registerUploadedModelRequestSchema>;

export const importBucketModelRequestSchema = z.object({
  provider: z.literal("aws"),
  uri: z.string().regex(/^s3:\/\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\/.+\/$/, "Use an s3:// prefix"),
  name: z.string().min(1).max(120),
  kind: z.enum(["model", "adapter"]),
  baseVersionId: z.string().min(1).nullable().default(null),
  licence: z.string().min(1).max(100),
  provenance: z.string().min(1).max(2000),
});
export type ImportBucketModelRequest = z.input<typeof importBucketModelRequestSchema>;

export const TRAINING_RUN_STATUSES = [
  "queued",
  "preparing",
  "submitted",
  "running",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
] as const;
export const trainingRunStatusSchema = z.enum(TRAINING_RUN_STATUSES);
export type TrainingRunStatus = z.infer<typeof trainingRunStatusSchema>;
export const ACTIVE_TRAINING_RUN_STATUSES: readonly TrainingRunStatus[] = [
  "queued",
  "preparing",
  "submitted",
  "running",
  "cancelling",
];

export const trainingMetricPointSchema = z.object({
  step: z.number().int().nonnegative(),
  epoch: z.number().nonnegative().nullable(),
  trainLoss: z.number().nullable(),
  validLoss: z.number().nullable(),
  reward: z.number().nullable(),
  learningRate: z.number().nullable(),
});
export type TrainingMetricPoint = z.infer<typeof trainingMetricPointSchema>;

export const trainingCheckpointSchema = z.object({
  id: z.string(),
  step: z.number().int().nonnegative(),
  providerRef: z.string(),
  versionId: z.string().nullable(),
  metrics: z.record(z.string(), z.number()),
  createdAt: z.string(),
});
export type TrainingCheckpoint = z.infer<typeof trainingCheckpointSchema>;

export const trainingRunSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  spec: trainingSpecSchema,
  specHash: z.string(),
  status: trainingRunStatusSchema,
  providerJobId: z.string().nullable(),
  outputVersionId: z.string().nullable(),
  datasetVersionIds: z.array(z.string()),
  estimate: costEstimateSchema,
  costUsd: z.number().nonnegative().nullable(),
  compute: modificationComputeSchema.nullable(),
  metrics: z.array(trainingMetricPointSchema),
  checkpoints: z.array(trainingCheckpointSchema),
  failureReason: z.string().nullable(),
  createdBy: z.number().int().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type TrainingRun = z.infer<typeof trainingRunSchema>;

export const trainingRunSummarySchema = trainingRunSchema
  .omit({ metrics: true, checkpoints: true })
  .extend({ baseName: z.string(), latestLoss: z.number().nullable() });
export type TrainingRunSummary = z.infer<typeof trainingRunSummarySchema>;

export const trainingRunsResponseSchema = z.object({ runs: z.array(trainingRunSummarySchema) });
export type TrainingRunsResponse = z.infer<typeof trainingRunsResponseSchema>;

export const trainerOptionSchema = z.object({
  provider: modelProviderIdSchema,
  providerName: z.string(),
  trainer: z.string(),
  trainerName: z.string(),
  connected: z.boolean(),
  supported: z.boolean(),
  reasons: z.array(z.string()),
  hardware: z.array(hardwareOptionSchema),
  regions: z.array(regionOptionSchema),
  estimate: costEstimateSchema,
  output: z.enum(["hub", "provider"]),
});
export type TrainerOption = z.infer<typeof trainerOptionSchema>;

export const trainingPlanRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  method: trainingMethodSchema,
  adaptation: adaptationSchema.default("lora"),
  baseVersionId: z.string().min(1),
  trainDatasetVersionId: z.string().min(1).nullable().default(null),
  graderId: z.string().min(1).nullable().default(null),
  hyperparameters: trainingHyperparametersSchema.default(trainingHyperparametersSchema.parse({})),
});
export type TrainingPlanRequest = z.input<typeof trainingPlanRequestSchema>;

export const trainingPlanSchema = z.object({
  options: z.array(trainerOptionSchema),
  compute: modificationComputeSchema.nullable(),
  tokens: z.number().nonnegative().nullable(),
  preflight: spendPreflightSchema,
  verdicts: z.object({ base: policyVerdictSchema, dataset: policyVerdictSchema.nullable() }),
});
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;

export const trainingRecommendationRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  goal: z.string().min(1).max(2000),
  datasetVersionId: z.string().min(1).nullable().default(null),
  graderId: z.string().min(1).nullable().default(null),
});
export type TrainingRecommendationRequest = z.input<typeof trainingRecommendationRequestSchema>;

export const trainingRecommendationSchema = z.object({
  method: trainingMethodSchema,
  adaptation: adaptationSchema,
  baseVersionId: z.string().nullable(),
  target: providerTargetSchema.nullable(),
  hyperparameters: trainingHyperparametersSchema,
  reasons: z.array(z.string()),
});
export type TrainingRecommendation = z.infer<typeof trainingRecommendationSchema>;

export const startTrainingRunRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  spec: trainingSpecSchema,
});
export type StartTrainingRunRequest = z.input<typeof startTrainingRunRequestSchema>;

export const modelTrainingRunParamsSchema = registryWorkspaceParamsSchema.extend({
  runId: z.string().min(1),
});

export const BUDGET_SCOPES = ["workspace", "project"] as const;

export const modelBudgetSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  monthlyLimitUsd: z.number().nonnegative(),
  softLimitPercent: z.number().int().min(1).max(100),
  hardStop: z.boolean(),
  approvalAboveUsd: z.number().nonnegative().nullable(),
  idlePauseMinutes: z.number().int().positive().nullable(),
  updatedAt: z.string(),
  updatedBy: z.number().int().nullable(),
});
export type ModelBudget = z.infer<typeof modelBudgetSchema>;

export const saveBudgetRequestSchema = z.object({
  projectId: z.string().min(1).nullable().default(null),
  monthlyLimitUsd: z.number().nonnegative().max(10_000_000),
  softLimitPercent: z.number().int().min(1).max(100).default(80),
  hardStop: z.boolean().default(true),
  approvalAboveUsd: z.number().nonnegative().max(10_000_000).nullable().default(null),
  idlePauseMinutes: z.number().int().positive().max(10_080).nullable().default(null),
});
export type SaveBudgetRequest = z.input<typeof saveBudgetRequestSchema>;

export const COST_SUBJECTS = ["training_run", "deployment", "inference", "job"] as const;
export const costSubjectSchema = z.enum(COST_SUBJECTS);

export const costEntrySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  subjectType: costSubjectSchema,
  subjectId: z.string(),
  provider: modelProviderIdSchema,
  usd: z.number().nonnegative(),
  basis: z.enum(["estimate", "reported", "metered"]),
  periodStart: z.string(),
  periodEnd: z.string(),
  createdAt: z.string(),
});
export type CostEntry = z.infer<typeof costEntrySchema>;

export const spendLineSchema = z.object({
  projectId: z.string().nullable(),
  spentUsd: z.number().nonnegative(),
  committedUsd: z.number().nonnegative(),
  limitUsd: z.number().nonnegative().nullable(),
});
export type SpendLine = z.infer<typeof spendLineSchema>;

export const spendSummarySchema = z.object({
  periodStart: z.string(),
  workspace: spendLineSchema,
  projects: z.array(spendLineSchema),
  bySubject: z.array(
    z.object({
      subjectType: costSubjectSchema,
      subjectId: z.string(),
      name: z.string(),
      provider: modelProviderIdSchema,
      usd: z.number().nonnegative(),
    }),
  ),
  budgets: z.array(modelBudgetSchema),
});
export type SpendSummary = z.infer<typeof spendSummarySchema>;

export const modelPermissionRoleSchema = z.enum(["owner", "admin", "member"]);
export type ModelPermissionRole = z.infer<typeof modelPermissionRoleSchema>;

export const MODEL_PLATFORM_ACTIONS = [
  "view",
  "import",
  "upload",
  "build_datasets",
  "train",
  "deploy",
  "promote",
  "approve",
  "manage_policy",
  "manage_connections",
  "manage_budgets",
] as const;
export const modelPlatformActionSchema = z.enum(MODEL_PLATFORM_ACTIONS);
export type ModelPlatformAction = z.infer<typeof modelPlatformActionSchema>;

export const modelPermissionsSchema = z.object({
  workspaceId: z.string(),
  grants: z.record(modelPermissionRoleSchema, z.array(modelPlatformActionSchema)),
  separationOfDuties: z.boolean(),
  updatedAt: z.string().nullable(),
  updatedBy: z.number().int().nullable(),
});
export type ModelPermissions = z.infer<typeof modelPermissionsSchema>;

export const saveModelPermissionsRequestSchema = z.object({
  grants: z.object({
    admin: z.array(modelPlatformActionSchema),
    member: z.array(modelPlatformActionSchema),
  }),
  separationOfDuties: z.boolean(),
});
export type SaveModelPermissionsRequest = z.infer<typeof saveModelPermissionsRequestSchema>;

export const myModelPermissionsSchema = z.object({
  role: modelPermissionRoleSchema,
  actions: z.array(modelPlatformActionSchema),
  separationOfDuties: z.boolean(),
});
export type MyModelPermissions = z.infer<typeof myModelPermissionsSchema>;

export const modelAuditQuerySchema = z.object({
  targetType: z.string().max(60).optional(),
  targetId: z.string().max(120).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});
export type ModelAuditQuery = z.infer<typeof modelAuditQuerySchema>;
export const modelAuditResponseSchema = z.object({ events: z.array(workspaceAuditRecordSchema) });

export const revokeVersionRequestSchema = z.object({ reason: z.string().min(1).max(1000) });
export type RevokeVersionRequest = z.infer<typeof revokeVersionRequestSchema>;

export const revocationResultSchema = z.object({
  versionId: z.string(),
  retiredRouteIds: z.array(z.string()),
  pausedDeploymentIds: z.array(z.string()),
  clearedAliasIds: z.array(z.string()),
});
export type RevocationResult = z.infer<typeof revocationResultSchema>;

export const trainingContentSummarySchema = z.object({
  versionId: z.string(),
  generatedAt: z.string(),
  modifier: z.object({ workspace: z.string() }),
  baseModel: z.object({ name: z.string(), revision: z.string() }).nullable(),
  compute: modificationComputeSchema.nullable(),
  providerObligationsLikely: z.boolean(),
  datasets: z.array(
    z.object({
      name: z.string(),
      collectionMethod: datasetCollectionMethodSchema,
      licence: z.string(),
      lawfulBasis: lawfulBasisSchema,
      personalDataCategories: z.array(z.string()),
      rows: z.number().int().nonnegative(),
      tokens: z.number().int().nonnegative(),
      piiRedacted: z.boolean(),
      teacher: z.string().nullable(),
    }),
  ),
});
export type TrainingContentSummary = z.infer<typeof trainingContentSummarySchema>;

export const modelInventoryItemSchema = z.object({
  versionId: z.string(),
  name: z.string(),
  kind: z.string(),
  source: z.string(),
  revision: z.string(),
  licence: z.string().nullable(),
  standing: z.string(),
  owner: z.number().int().nullable(),
  deployments: z.number().int().nonnegative(),
  aliases: z.array(z.string()),
  jurisdictions: z.array(z.string()),
  exceedsModificationThreshold: z.boolean(),
});
export type ModelInventoryItem = z.infer<typeof modelInventoryItemSchema>;
export const modelInventoryResponseSchema = z.object({
  generatedAt: z.string(),
  items: z.array(modelInventoryItemSchema),
});

export const modelsOverviewSchema = z.object({
  aliases: z.array(modelAliasSchema.extend({ targetName: z.string().nullable() })),
  deployments: z.array(modelDeploymentSchema.extend({ displayName: z.string() })),
  runs: z.array(trainingRunSummarySchema),
  pendingDecisions: z.number().int().nonnegative(),
  spend: spendSummarySchema,
  connectedProviders: z.array(modelProviderIdSchema),
  permissions: myModelPermissionsSchema,
});
export type ModelsOverview = z.infer<typeof modelsOverviewSchema>;

export const MODEL_DATASET_PROCESS_TASK_TYPE = "model_dataset_process";
export const MODEL_TRAINING_SYNC_TASK_TYPE = "model_training_sync";
export const MODEL_DEPLOYMENT_SYNC_TASK_TYPE = "model_deployment_sync";
export const MODEL_UPLOAD_FINALISE_TASK_TYPE = "model_upload_finalise";
export const MODEL_PLATFORM_RECONCILE_TASK_TYPE = "model_platform_reconcile";

export const modelDatasetProcessTaskDataSchema = z.object({ versionId: z.string().min(1) });
export const modelTrainingSyncTaskDataSchema = z.object({ runId: z.string().min(1) });
export const modelDeploymentSyncTaskDataSchema = z.object({ deploymentId: z.string().min(1) });
export const modelUploadFinaliseTaskDataSchema = z.object({
  uploadId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  publishJobId: z.string().min(1).optional(),
});
export const modelPlatformReconcileTaskDataSchema = z.object({ workspaceId: z.string().min(1) });

export function aliasChatModelId(aliasId: string): string {
  return `alias:${aliasId}`;
}

export function deploymentChatModelId(deploymentId: string): string {
  return `deployment:${deploymentId}`;
}

export function parsePlatformChatModelId(
  modelId: string,
): { kind: "alias" | "deployment"; id: string } | null {
  const match = /^(alias|deployment):([A-Za-z0-9_-]{6,64})$/.exec(modelId);

  return match ? { kind: match[1] === "alias" ? "alias" : "deployment", id: match[2] } : null;
}

export const SPEND_REQUEST_STATES = [
  "pending",
  "executing",
  "approved",
  "rejected",
  "failed",
] as const;

export const spendRequestSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  subjectType: z.enum(["training_run", "deployment"]),
  summary: z.string(),
  estimateUsd: z.number().nonnegative().nullable(),
  reason: z.string().nullable(),
  state: z.enum(SPEND_REQUEST_STATES),
  subjectId: z.string().nullable(),
  requestedBy: z.number().int().nullable(),
  decidedBy: z.number().int().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type SpendRequest = z.infer<typeof spendRequestSchema>;

export const spendRequestsResponseSchema = z.object({ requests: z.array(spendRequestSchema) });

export const resolveSpendRequestSchema = z.object({ state: z.enum(["approved", "rejected"]) });
export type ResolveSpendRequest = z.infer<typeof resolveSpendRequestSchema>;

export const modelSpendRequestParamsSchema = registryWorkspaceParamsSchema.extend({
  requestId: z.string().min(1),
});

export const deploymentStartResultSchema = z.object({
  deployment: modelDeploymentSchema.nullable(),
  spendRequest: spendRequestSchema.nullable(),
  preflight: spendPreflightSchema,
});
export type DeploymentStartResult = z.infer<typeof deploymentStartResultSchema>;

export const trainingStartResultSchema = z.object({
  run: trainingRunSchema.nullable(),
  spendRequest: spendRequestSchema.nullable(),
  preflight: spendPreflightSchema,
});
export type TrainingStartResult = z.infer<typeof trainingStartResultSchema>;

export const budgetScopeQuerySchema = z.object({ projectId: z.string().min(1).optional() });

export const PLATFORM_DEPLOYMENT_CHAT_PROVIDER = "polychat-deployment";

export const uploadPreviewSchema = z.object({
  columns: z.array(z.string()),
  mapping: datasetMappingSchema,
  sample: z.array(z.record(z.string(), z.unknown())),
});
export type UploadPreview = z.infer<typeof uploadPreviewSchema>;

export const uploadPartResponseSchema = z.object({
  partNumber: z.number().int(),
  etag: z.string(),
});
