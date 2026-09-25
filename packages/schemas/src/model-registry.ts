import z from "zod/v4";

export const MODEL_ASSET_KINDS = ["model", "dataset"] as const;
export const modelAssetKindSchema = z.enum(MODEL_ASSET_KINDS);
export type ModelAssetKind = z.infer<typeof modelAssetKindSchema>;

export const MODEL_ASSET_SOURCES = ["huggingface", "derived"] as const;
export const modelAssetSourceSchema = z.enum(MODEL_ASSET_SOURCES);
export type ModelAssetSource = z.infer<typeof modelAssetSourceSchema>;

export const WEIGHT_FORMATS = ["safetensors", "gguf", "pickle", "onnx", "other"] as const;
export const weightFormatSchema = z.enum(WEIGHT_FORMATS);
export type WeightFormat = z.infer<typeof weightFormatSchema>;

export const modelVersionStatusSchema = z.enum(["importing", "inspecting", "ready", "failed"]);
export type ModelVersionStatus = z.infer<typeof modelVersionStatusSchema>;

export const EVIDENCE_KINDS = [
  "licence",
  "format",
  "remote_code",
  "chat_template",
  "hub_scan",
  "pickle_imports",
  "gating",
  "card",
  "signature",
  "eval",
  "public_eval",
  "dataset_stats",
  "pii",
  "residency",
  "drift",
] as const;
export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const EVIDENCE_STATUSES = ["pass", "warn", "fail", "unknown"] as const;
export const evidenceStatusSchema = z.enum(EVIDENCE_STATUSES);
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

export const EVIDENCE_SOURCES = [
  "hub_metadata",
  "hub_scan",
  "static_inspection",
  "polychat_eval",
  "community_eval",
  "guardrails",
  "route_registry",
  "replay",
] as const;
export const evidenceSourceSchema = z.enum(EVIDENCE_SOURCES);
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

export const POLICY_EFFECTS = ["allow", "warn", "review", "block"] as const;
export const policyEffectSchema = z.enum(POLICY_EFFECTS);
export type PolicyEffect = z.infer<typeof policyEffectSchema>;

export const modelVersionAttributesSchema = z.object({
  licence: z.string().nullable(),
  formats: z.array(weightFormatSchema),
  parameterCount: z.number().int().nonnegative().nullable(),
  gated: z.boolean(),
  remoteCode: z.boolean(),
  pipelineTag: z.string().nullable(),
  libraryName: z.string().nullable(),
  tags: z.array(z.string()),
  baseModels: z.array(z.string()),
  totalBytes: z.number().int().nonnegative(),
  trainingComputeFlops: z.number().nonnegative().nullable(),
});
export type ModelVersionAttributes = z.infer<typeof modelVersionAttributesSchema>;

const stringListSchema = z.array(z.string().min(1)).min(1).max(100);
const inclusionOperatorSchema = z.enum(["in", "not_in"]);

export const policyConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),
  z.object({ type: z.literal("asset_kind"), values: z.array(modelAssetKindSchema).min(1) }),
  z.object({ type: z.literal("licence"), op: inclusionOperatorSchema, values: stringListSchema }),
  z.object({ type: z.literal("source"), op: inclusionOperatorSchema, values: stringListSchema }),
  z.object({
    type: z.literal("format"),
    op: z.enum(["includes", "only"]),
    values: z.array(weightFormatSchema).min(1),
  }),
  z.object({ type: z.literal("remote_code") }),
  z.object({ type: z.literal("gated") }),
  z.object({ type: z.literal("parameters_above"), value: z.number().positive() }),
  z.object({
    type: z.literal("evidence"),
    kind: evidenceKindSchema,
    statuses: z.array(evidenceStatusSchema).min(1),
  }),
  z.object({ type: z.literal("evidence_missing"), kind: evidenceKindSchema }),
  z.object({
    type: z.literal("route_region"),
    op: inclusionOperatorSchema,
    values: stringListSchema,
  }),
  z.object({ type: z.literal("route_weights_unverified") }),
]);
export type PolicyCondition = z.infer<typeof policyConditionSchema>;

export const policyRuleSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().max(300).optional(),
  effect: policyEffectSchema,
  when: policyConditionSchema,
});
export type PolicyRule = z.infer<typeof policyRuleSchema>;

export const policyRulesSchema = z
  .array(policyRuleSchema)
  .max(50)
  .refine((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length, {
    message: "Rule ids must be unique",
  });

export const modelGovernanceEnforcementSchema = z.enum(["advisory", "enforced"]);
export type ModelGovernanceEnforcement = z.infer<typeof modelGovernanceEnforcementSchema>;

export const modelPolicySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  rules: policyRulesSchema,
  revision: z.number().int().nonnegative(),
  hash: z.string(),
  enforcement: modelGovernanceEnforcementSchema,
  updatedAt: z.string(),
  updatedBy: z.number().int().nullable(),
  isDefault: z.boolean(),
});
export type ModelPolicy = z.infer<typeof modelPolicySchema>;

export const policyMatchSchema = z.object({
  policyId: z.string(),
  policyHash: z.string(),
  scope: z.enum(["workspace", "project"]),
  ruleId: z.string(),
  effect: policyEffectSchema,
  reason: z.string(),
});
export type PolicyMatch = z.infer<typeof policyMatchSchema>;

export const policyVerdictSchema = z.object({
  effect: policyEffectSchema,
  matches: z.array(policyMatchSchema),
  policyHashes: z.array(z.string()),
});
export type PolicyVerdict = z.infer<typeof policyVerdictSchema>;

export const modelAssetSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  kind: modelAssetKindSchema,
  source: modelAssetSourceSchema,
  sourceRef: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
  createdBy: z.number().int().nullable(),
});
export type ModelAsset = z.infer<typeof modelAssetSchema>;

export const modelVersionFileSchema = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().nullable(),
  format: weightFormatSchema.nullable(),
});
export type ModelVersionFile = z.infer<typeof modelVersionFileSchema>;

export const modelVersionSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  workspaceId: z.string(),
  revision: z.string(),
  status: modelVersionStatusSchema,
  attributes: modelVersionAttributesSchema,
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.number().int().nullable(),
});
export type ModelVersion = z.infer<typeof modelVersionSchema>;

export const modelEvidenceSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  routeId: z.string().nullable(),
  kind: evidenceKindSchema,
  source: evidenceSourceSchema,
  status: evidenceStatusSchema,
  summary: z.string(),
  details: z.record(z.string(), z.unknown()),
  observedAt: z.string(),
});
export type ModelEvidence = z.infer<typeof modelEvidenceSchema>;

export const modelDecisionStateSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "revoked",
  "expired",
]);
export type ModelDecisionState = z.infer<typeof modelDecisionStateSchema>;

export const modelDecisionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  versionId: z.string(),
  routeId: z.string().nullable(),
  state: modelDecisionStateSchema,
  verdict: policyVerdictSchema,
  evidenceIds: z.array(z.string()),
  isException: z.boolean(),
  conditions: z.string().nullable(),
  note: z.string().nullable(),
  requestedBy: z.number().int().nullable(),
  decidedBy: z.number().int().nullable(),
  decidedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ModelDecision = z.infer<typeof modelDecisionSchema>;

export const modelRouteStatusSchema = z.enum(["active", "retired"]);

export const modelRouteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  versionId: z.string(),
  provider: z.string(),
  providerModelId: z.string(),
  region: z.string(),
  weightsVerified: z.boolean(),
  status: modelRouteStatusSchema,
  deploymentRef: z.string().nullable(),
  createdAt: z.string(),
});
export type ModelRoute = z.infer<typeof modelRouteSchema>;

export const LINEAGE_RELATIONS = [
  "fine_tuned_from",
  "trained_on",
  "evaluated_on",
  "quantised_from",
] as const;
export const lineageRelationSchema = z.enum(LINEAGE_RELATIONS);
export type LineageRelation = z.infer<typeof lineageRelationSchema>;

export const lineageEdgeSchema = z.object({
  fromVersionId: z.string(),
  toVersionId: z.string(),
  relation: lineageRelationSchema,
});
export type LineageEdge = z.infer<typeof lineageEdgeSchema>;

export const evalCaseSchema = z.object({
  id: z.string().min(1).max(64),
  input: z.string().min(1).max(20_000),
  expected: z.string().max(20_000).optional(),
});
export type EvalCase = z.infer<typeof evalCaseSchema>;

export const evalScorerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("exact"), metric: z.string().min(1).max(40) }),
  z.object({ type: z.literal("contains"), metric: z.string().min(1).max(40) }),
  z.object({
    type: z.literal("regex"),
    metric: z.string().min(1).max(40),
    pattern: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal("judge"),
    metric: z.string().min(1).max(40),
    rubric: z.string().min(1).max(4000),
  }),
]);
export type EvalScorer = z.infer<typeof evalScorerSchema>;

export const evalSuiteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  systemPrompt: z.string().nullable(),
  cases: z.array(evalCaseSchema),
  scorers: z.array(evalScorerSchema),
  replaySampleSize: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EvalSuite = z.infer<typeof evalSuiteSchema>;

export const scoreSummarySchema = z.object({
  mean: z.number(),
  low: z.number(),
  high: z.number(),
  n: z.number().int().nonnegative(),
});
export type ScoreSummary = z.infer<typeof scoreSummarySchema>;

export const evalRunTriggerSchema = z.enum(["manual", "build", "replay"]);
export const evalRunStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const evalRunSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  routeId: z.string(),
  versionId: z.string(),
  trigger: evalRunTriggerSchema,
  status: evalRunStatusSchema,
  scores: z.record(z.string(), scoreSummarySchema),
  latencyP95Ms: z.number().nullable(),
  casesCompleted: z.number().int().nonnegative(),
  casesTotal: z.number().int().nonnegative(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type EvalRun = z.infer<typeof evalRunSchema>;

export const sourceSearchResultSchema = z.object({
  source: modelAssetSourceSchema,
  sourceRef: z.string(),
  kind: modelAssetKindSchema,
  displayName: z.string(),
  licence: z.string().nullable(),
  pipelineTag: z.string().nullable(),
  gated: z.boolean(),
  downloads: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  signals: z.array(z.object({ label: z.string(), status: evidenceStatusSchema })),
  preview: policyVerdictSchema,
  library: z
    .object({
      assetId: z.string(),
      latestVersionId: z.string().nullable(),
      state: modelDecisionStateSchema.nullable(),
    })
    .nullable(),
});
export type SourceSearchResult = z.infer<typeof sourceSearchResultSchema>;

export const registryWorkspaceParamsSchema = z.object({ workspaceId: z.string().min(1) });
export const registryVersionParamsSchema = registryWorkspaceParamsSchema.extend({
  versionId: z.string().min(1),
});

export const sourceSearchQuerySchema = z.object({
  q: z.string().max(200).default(""),
  kind: modelAssetKindSchema.default("model"),
  projectId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
export type SourceSearchQuery = z.infer<typeof sourceSearchQuerySchema>;

export const libraryQuerySchema = z.object({
  kind: modelAssetKindSchema.optional(),
  projectId: z.string().min(1).optional(),
  approvedOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
export type LibraryQuery = z.infer<typeof libraryQuerySchema>;

export const importAssetRequestSchema = z.object({
  source: z.literal("huggingface"),
  kind: modelAssetKindSchema,
  sourceRef: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[A-Za-z0-9][\w.-]*\/[\w.-]+$/, "Use the owner/name form"),
  revision: z
    .string()
    .regex(/^[\w./-]{1,120}$/)
    .optional(),
});
export type ImportAssetRequest = z.infer<typeof importAssetRequestSchema>;

export const upsertPolicyRequestSchema = z.object({
  projectId: z.string().min(1).nullable(),
  rules: policyRulesSchema,
  enforcement: modelGovernanceEnforcementSchema.optional(),
});
export type UpsertPolicyRequest = z.infer<typeof upsertPolicyRequestSchema>;

export const policyDryRunRequestSchema = z.object({
  projectId: z.string().min(1).nullable(),
  rules: policyRulesSchema,
  versionIds: z.array(z.string().min(1)).max(200).optional(),
});
export type PolicyDryRunRequest = z.infer<typeof policyDryRunRequestSchema>;

export const policyDryRunResultSchema = z.object({
  changes: z.array(
    z.object({
      versionId: z.string(),
      displayName: z.string(),
      before: policyEffectSchema,
      after: policyEffectSchema,
    }),
  ),
  evaluated: z.number().int().nonnegative(),
});
export type PolicyDryRunResult = z.infer<typeof policyDryRunResultSchema>;

export const requestDecisionSchema = z.object({
  versionId: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  routeId: z.string().min(1).nullable().optional(),
  exception: z.boolean().default(false),
  note: z.string().max(2000).optional(),
});
export type RequestDecisionInput = z.infer<typeof requestDecisionSchema>;

export const resolveDecisionSchema = z.object({
  state: z.enum(["approved", "rejected", "revoked"]),
  note: z.string().max(2000).optional(),
  conditions: z.string().max(500).optional(),
  expiresInDays: z.number().int().positive().max(730).optional(),
});
export type ResolveDecisionInput = z.infer<typeof resolveDecisionSchema>;

export const registryDecisionParamsSchema = registryWorkspaceParamsSchema.extend({
  decisionId: z.string().min(1),
});

export const decisionListQuerySchema = z.object({
  state: modelDecisionStateSchema.optional(),
  projectId: z.string().min(1).optional(),
});

export const createRouteRequestSchema = z.object({
  versionId: z.string().min(1),
  provider: z.string().min(1).max(64),
  providerModelId: z.string().min(1).max(200),
  region: z.string().min(1).max(32),
  weightsVerified: z.boolean().default(false),
});
export type CreateRouteRequest = z.infer<typeof createRouteRequestSchema>;

export const registryRouteParamsSchema = registryWorkspaceParamsSchema.extend({
  routeId: z.string().min(1),
});

export const createEvalSuiteRequestSchema = z.object({
  projectId: z.string().min(1).nullable(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().max(8000).optional(),
  cases: z.array(evalCaseSchema).min(1).max(500),
  scorers: z.array(evalScorerSchema).min(1).max(8),
  replaySampleSize: z.number().int().positive().max(200).default(50),
});
export type CreateEvalSuiteRequest = z.infer<typeof createEvalSuiteRequestSchema>;

export const registrySuiteParamsSchema = registryWorkspaceParamsSchema.extend({
  suiteId: z.string().min(1),
});

export const startEvalRunsRequestSchema = z.object({
  routeIds: z.array(z.string().min(1)).min(1).max(6),
});
export type StartEvalRunsRequest = z.infer<typeof startEvalRunsRequestSchema>;

export const libraryEntrySchema = z.object({
  asset: modelAssetSchema,
  version: modelVersionSchema,
  verdict: policyVerdictSchema,
  usable: z.boolean(),
  decision: modelDecisionSchema.nullable(),
  routeCount: z.number().int().nonnegative(),
});
export type LibraryEntry = z.infer<typeof libraryEntrySchema>;

export const libraryResponseSchema = z.object({ entries: z.array(libraryEntrySchema) });
export const sourceSearchResponseSchema = z.object({ results: z.array(sourceSearchResultSchema) });

export const versionDetailSchema = z.object({
  asset: modelAssetSchema,
  version: modelVersionSchema,
  files: z.array(modelVersionFileSchema),
  evidence: z.array(modelEvidenceSchema),
  decisions: z.array(modelDecisionSchema),
  routes: z.array(modelRouteSchema),
  lineage: z.array(lineageEdgeSchema),
  evalRuns: z.array(evalRunSchema),
  verdict: policyVerdictSchema,
  versions: z.array(z.object({ id: z.string(), revision: z.string(), createdAt: z.string() })),
});
export type VersionDetail = z.infer<typeof versionDetailSchema>;

export const policiesResponseSchema = z.object({
  workspace: modelPolicySchema,
  projects: z.array(modelPolicySchema),
});
export type PoliciesResponse = z.infer<typeof policiesResponseSchema>;

export const decisionsResponseSchema = z.object({
  decisions: z.array(
    modelDecisionSchema.extend({
      displayName: z.string(),
      revision: z.string(),
    }),
  ),
});
export type DecisionsResponse = z.infer<typeof decisionsResponseSchema>;

export const routesResponseSchema = z.object({
  routes: z.array(
    modelRouteSchema.extend({
      displayName: z.string(),
      approved: z.boolean(),
    }),
  ),
});
export type RoutesResponse = z.infer<typeof routesResponseSchema>;

export const evalSuitesResponseSchema = z.object({ suites: z.array(evalSuiteSchema) });
export const evalRunsResponseSchema = z.object({ runs: z.array(evalRunSchema) });

export const routeHealthSchema = z.object({
  routeId: z.string(),
  requests: z.number().int().nonnegative(),
  latencyP95Ms: z.number().nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  replayTrend: z.array(z.object({ at: z.string(), score: z.number(), metric: z.string() })),
  baseline: z.object({ metric: z.string(), score: z.number() }).nullable(),
});
export type RouteHealth = z.infer<typeof routeHealthSchema>;

export const MODEL_REGISTRY_INSPECT_TASK_TYPE = "model_registry_inspect";
export const MODEL_REGISTRY_EVAL_TASK_TYPE = "model_registry_eval";

export const modelRegistryVersionTaskDataSchema = z.object({ versionId: z.string().min(1) });
export const modelRegistryEvalTaskDataSchema = z.object({
  runId: z.string().min(1),
  offset: z.number().int().nonnegative().default(0),
  readinessAttempt: z.number().int().nonnegative().default(0),
});

export const routeSuggestionSchema = z.object({
  provider: z.string(),
  providerModelId: z.string(),
  name: z.string(),
  region: z.string(),
  registered: z.boolean(),
});
export type RouteSuggestion = z.infer<typeof routeSuggestionSchema>;
export const routeSuggestionsResponseSchema = z.object({
  suggestions: z.array(routeSuggestionSchema),
});

export const evalCaseResultSchema = z.object({
  caseId: z.string(),
  output: z.string(),
  latencyMs: z.number(),
  scores: z.record(z.string(), z.number()),
  error: z.string().optional(),
});
export type EvalCaseResult = z.infer<typeof evalCaseResultSchema>;
export const evalCaseResultsResponseSchema = z.object({ results: z.array(evalCaseResultSchema) });

export const registryRunParamsSchema = registryWorkspaceParamsSchema.extend({
  runId: z.string().min(1),
});
export const bomQuerySchema = z.object({ routeId: z.string().min(1).optional() });
export const registryProjectScopeQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
});

export const modelBuildStatusSchema = z.enum(["running", "completed", "failed"]);

export const modificationComputeSchema = z.object({
  modificationFlops: z.number().nonnegative(),
  thresholdFlops: z.number().positive(),
  ratio: z.number().nonnegative(),
  exceedsThreshold: z.boolean(),
  basis: z.enum(["reported", "fallback"]),
});
export type ModificationCompute = z.infer<typeof modificationComputeSchema>;

export const modelBuildSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  versionId: z.string(),
  baseVersionId: z.string(),
  datasetVersionId: z.string(),
  provider: z.string(),
  jobName: z.string(),
  recipe: z.enum(["sft-full", "sft-lora"]),
  status: modelBuildStatusSchema,
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  compute: modificationComputeSchema.nullable(),
});
export type ModelBuild = z.infer<typeof modelBuildSchema>;

export const startBuildRequestSchema = z.object({
  projectId: z.string().min(1).nullable(),
  baseVersionId: z.string().min(1),
  recipe: z.enum(["sft-full", "sft-lora"]).default("sft-lora"),
  epochs: z.number().positive().max(20).default(2),
  flavor: z.string().min(1).max(40).optional(),
  minFeedbackRating: z.number().int().min(1).max(5).optional(),
  minQualityScore: z.number().min(0).max(10).optional(),
  exampleLimit: z.number().int().positive().max(5000).default(1000),
});
export type StartBuildRequest = z.infer<typeof startBuildRequestSchema>;

export const buildsResponseSchema = z.object({ builds: z.array(modelBuildSchema) });

export const deployVersionRequestSchema = z.object({
  projectId: z.string().min(1).nullable(),
  instanceType: z.string().min(1).max(60).optional(),
});
export type DeployVersionRequest = z.infer<typeof deployVersionRequestSchema>;

export const HUGGINGFACE_ENDPOINT_LOCATIONS = [
  { vendor: "aws", region: "eu-west-1", label: "AWS Ireland" },
  { vendor: "aws", region: "us-east-1", label: "AWS N. Virginia" },
  { vendor: "gcp", region: "us-east4", label: "Google Cloud Virginia" },
  { vendor: "azure", region: "eastus", label: "Azure East US" },
] as const;

export const huggingFaceConnectionSourceSchema = z.enum(["workspace", "platform", "none"]);
export type HuggingFaceConnectionSource = z.infer<typeof huggingFaceConnectionSourceSchema>;

export const huggingFaceConnectionSchema = z.object({
  source: huggingFaceConnectionSourceSchema,
  account: z.string().nullable(),
  organisation: z.string().nullable(),
  endpointVendor: z.string(),
  endpointRegion: z.string(),
  canTrainAndDeploy: z.boolean(),
  updatedAt: z.string().nullable(),
});
export type HuggingFaceConnection = z.infer<typeof huggingFaceConnectionSchema>;

export const huggingFaceTokenCheckRequestSchema = z.object({
  token: z.string().trim().min(8).max(500).optional(),
});
export type HuggingFaceTokenCheckRequest = z.infer<typeof huggingFaceTokenCheckRequestSchema>;

export const huggingFaceTokenCheckSchema = z.object({
  account: z.string(),
  canWrite: z.boolean(),
  organisations: z.array(z.object({ name: z.string(), canWrite: z.boolean() })),
});
export type HuggingFaceTokenCheck = z.infer<typeof huggingFaceTokenCheckSchema>;

export const saveHuggingFaceConnectionRequestSchema = z.object({
  token: z.string().trim().min(8).max(500).optional(),
  organisation: z.string().trim().min(1).max(96).nullable(),
  endpointVendor: z.string().trim().min(1).max(20),
  endpointRegion: z.string().trim().min(1).max(40),
});
export type SaveHuggingFaceConnectionRequest = z.infer<
  typeof saveHuggingFaceConnectionRequestSchema
>;
