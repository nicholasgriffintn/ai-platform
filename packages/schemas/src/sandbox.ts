import z from "zod/v4";

import { reasoningEffortSchema, reasoningSettingsSchema } from "./reasoning";
import { sandboxEnvironmentCacheRecordSchema } from "./sandbox-cache";
import { sandboxDeliveryPolicySchema } from "./sandbox-delivery";
import {
  sandboxEnvironmentPreparationModeSchema,
  sandboxEnvironmentPreparationStatusSchema,
  sandboxEnvironmentSetupSchema,
  sandboxPackageManagerRequirementSchema,
  sandboxRuntimeRequirementSchema,
} from "./sandbox-environment";
import {
  sandboxRunServiceEvidenceSchema,
  sandboxServiceActionSchema,
  sandboxServiceNameSchema,
  sandboxServicePortSchema,
  sandboxServiceStatusSchema,
} from "./sandbox-services";
export * from "./sandbox-constants";
import {
  SANDBOX_PROMPT_STRATEGIES,
  SANDBOX_RUN_PROOF_MAX_CHANGED_FILES,
  SANDBOX_TASK_TYPES,
  SANDBOX_TIMEOUT_MAX_SECONDS,
  SANDBOX_TIMEOUT_MIN_SECONDS,
  SANDBOX_TRUST_LEVELS,
  type SandboxModelSettings,
  type SandboxPromptStrategy,
  type SandboxTaskType,
  type SandboxTrustLevel,
} from "./sandbox-constants";
import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "./tasks";

export const sandboxWebhookCommandSchema = z.enum(["implement", "review", "test", "fix"]);
export const sandboxRepoSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[\w.-]+\/[\w.-]+$/, "repo must be in owner/repo format");

export const githubConnectionSchema = z.object({
  installationId: z.number().int().positive(),
  appId: z.string().trim().min(1),
  privateKey: z.string().trim().min(1),
  webhookSecret: z.string().trim().min(1).optional(),
  repositories: z.array(z.string().trim().min(1)).optional(),
});

export const sandboxModelSettingsSchema = z.object({
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  max_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().optional(),
  frequency_penalty: z.number().optional(),
  reasoning_effort: reasoningEffortSchema.optional(),
  reasoning: reasoningSettingsSchema.optional(),
  verbosity: z.enum(["low", "medium", "high", "caveman"]).optional(),
});

export const executeSandboxRunSchema = z.object({
  installationId: z.number().int().positive(),
  repo: sandboxRepoSchema,
  task: z.string().trim().min(1),
  taskType: z.enum(SANDBOX_TASK_TYPES).optional(),
  model: z.string().trim().min(1).optional(),
  promptStrategy: z.enum(SANDBOX_PROMPT_STRATEGIES).optional(),
  deliveryPolicy: sandboxDeliveryPolicySchema.optional(),
  shouldCommit: z.boolean().optional(),
  environmentSetup: sandboxEnvironmentSetupSchema.optional(),
  timeoutSeconds: z
    .number()
    .int()
    .min(SANDBOX_TIMEOUT_MIN_SECONDS)
    .max(SANDBOX_TIMEOUT_MAX_SECONDS)
    .optional(),
  trustLevel: z.enum(SANDBOX_TRUST_LEVELS).optional(),
  modelSettings: sandboxModelSettingsSchema.optional(),
});

export const sandboxRunDispatchPayloadSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  installationId: z.number().int().positive(),
  repo: sandboxRepoSchema,
  task: z.string().trim().min(1),
  taskType: z.enum(SANDBOX_TASK_TYPES).optional(),
  model: z.string().trim().min(1).optional(),
  promptStrategy: z.enum(SANDBOX_PROMPT_STRATEGIES).optional(),
  deliveryPolicy: sandboxDeliveryPolicySchema.optional(),
  shouldCommit: z.boolean().optional(),
  environmentSetup: sandboxEnvironmentSetupSchema.optional(),
  environmentPreparationMode: sandboxEnvironmentPreparationModeSchema.optional(),
  environmentCache: sandboxEnvironmentCacheRecordSchema.optional(),
  environmentCacheGeneration: z.number().int().nonnegative().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  trustLevel: z.enum(SANDBOX_TRUST_LEVELS).optional(),
  modelSettings: sandboxModelSettingsSchema.optional(),
});

export const sandboxRunDispatchMessageSchema = z.object({
  kind: z.literal(SANDBOX_RUN_DISPATCH_TASK_TYPE),
  runId: z.string().trim().min(1),
  recordId: z.string().trim().min(1),
  userId: z.number().int().positive(),
  payload: sandboxRunDispatchPayloadSchema,
});

export const autoConnectSchema = z.object({
  installationId: z.number().int().positive(),
  repositories: z.array(z.string().trim().min(1)).optional(),
});

export const sandboxConnectionRepositoriesSchema = z.object({
  repositories: z.array(sandboxRepoSchema),
});

export const sandboxRunParamsSchema = z.object({
  runId: z.string().trim().min(1),
});

export type SandboxRunParams = z.infer<typeof sandboxRunParamsSchema>;

export const listRunInstructionsQuerySchema = z.object({
  after: z.coerce.number().int().min(0).optional(),
});

export const sandboxRunInstructionKindSchema = z.enum([
  "message",
  "continue",
  "approval_request",
  "approval_response",
  "service_action",
]);

export const submitRunInstructionSchema = z
  .object({
    kind: sandboxRunInstructionKindSchema.default("message"),
    idempotencyKey: z.string().trim().min(1).max(100).optional(),
    content: z.string().trim().max(2000).optional(),
    command: z.string().trim().min(1).max(1000).optional(),
    requestId: z.string().trim().min(1).optional(),
    approvalStatus: z.enum(["approved", "rejected"]).optional(),
    serviceName: sandboxServiceNameSchema.optional(),
    serviceAction: sandboxServiceActionSchema.optional(),
    timeoutSeconds: z.number().int().min(5).max(1800).optional(),
    escalateAfterSeconds: z.number().int().min(1).max(900).optional(),
  })
  .superRefine((input, context) => {
    if (input.kind !== "approval_request" && !input.idempotencyKey) {
      context.addIssue({
        code: "custom",
        path: ["idempotencyKey"],
        message: "idempotencyKey is required for operator instructions",
      });
    }

    if (input.kind === "service_action" && (!input.serviceName || !input.serviceAction)) {
      context.addIssue({
        code: "custom",
        path: input.serviceName ? ["serviceAction"] : ["serviceName"],
        message: "Service name and action are required for service controls",
      });
    }
  });

export const sandboxConnectionSchema = z.object({
  installationId: z.number().int().positive(),
  appId: z.string().trim().min(1),
  repositories: z.array(z.string().trim().min(1)),
  hasWebhookSecret: z.boolean(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

export const sandboxInstallConfigSchema = z.object({
  installUrl: z.url().optional(),
  canAutoConnect: z.boolean(),
  callbackUrl: z.url().optional(),
});

export const sandboxRunStatusSchema = z.enum([
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export const sandboxRunTerminalStatusSchema = z.enum(["completed", "failed", "cancelled"]);

export const sandboxRunValidationCheckSchema = z
  .object({
    command: z.string().trim().min(1),
    status: z.enum(["passed", "failed"]),
    exitCode: z.number().int().optional(),
  })
  .strict();

export const sandboxRunEnvironmentEvidenceSchema = z
  .object({
    source: z.enum(["polychat", "repository"]),
    configurationRevision: z.string().trim().min(1),
    configurationPath: z.string().trim().min(1).optional(),
    preparationMode: sandboxEnvironmentPreparationModeSchema,
    status: sandboxEnvironmentPreparationStatusSchema,
    runtimes: z.array(sandboxRuntimeRequirementSchema),
    packageManager: sandboxPackageManagerRequirementSchema.optional(),
    durationSeconds: z.number().nonnegative(),
    commandCount: z.number().int().nonnegative(),
    cache: z
      .object({
        status: z.enum(["created", "reused", "miss", "failed"]),
        cacheKey: z.string().trim().min(1),
        createdAt: z.string().trim().min(1).optional(),
        ageSeconds: z.number().nonnegative().optional(),
        invalidationReason: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const sandboxRunProofEvidenceSchema = z
  .object({
    repository: z
      .object({
        baseRevision: z.string().trim().min(1).optional(),
        headRevision: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    changedFileCount: z.number().int().nonnegative().optional(),
    changedFiles: z
      .array(z.string().trim().min(1))
      .max(SANDBOX_RUN_PROOF_MAX_CHANGED_FILES)
      .optional(),
    validation: z
      .object({
        qualityGate: z.enum(["passed", "failed", "skipped"]),
        checks: z.array(sandboxRunValidationCheckSchema),
      })
      .strict()
      .optional(),
    environment: sandboxRunEnvironmentEvidenceSchema.optional(),
    services: z.array(sandboxRunServiceEvidenceSchema).max(8).optional(),
    delivery: z
      .object({
        policy: sandboxDeliveryPolicySchema.optional(),
        branch: z.string().trim().min(1).optional(),
        commit: z.string().trim().min(1).optional(),
        pullRequestUrl: z.url().optional(),
      })
      .strict()
      .optional(),
    residualRisks: z.array(z.string().trim().min(1)).optional(),
    incompleteWork: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export const sandboxRunArtifactReferenceSchema = z
  .object({
    outputId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative(),
    url: z.string().trim().min(1),
  })
  .strict();

export const sandboxRunManifestOutcomeSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("completed"),
      success: z.literal(true),
      summary: z.string().trim().min(1).optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal("failed"),
      success: z.literal(false),
      summary: z.string().trim().min(1).optional(),
      error: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      status: z.literal("cancelled"),
      success: z.literal(false),
      summary: z.string().trim().min(1).optional(),
      cancellationReason: z.string().trim().min(1).optional(),
    })
    .strict(),
]);

export const sandboxRunManifestSchema = z
  .object({
    version: z.literal(1),
    runId: z.string().trim().min(1),
    objective: z.string().trim().min(1),
    outcome: sandboxRunManifestOutcomeSchema,
    timestamps: z
      .object({
        startedAt: z.string().trim().min(1),
        updatedAt: z.string().trim().min(1),
        completedAt: z.string().trim().min(1),
      })
      .strict(),
    repository: z
      .object({
        name: sandboxRepoSchema,
        baseRevision: z.string().trim().min(1).optional(),
        headRevision: z.string().trim().min(1).optional(),
      })
      .strict(),
    changes: z
      .object({
        fileCount: z.number().int().nonnegative(),
        files: z.array(z.string().trim().min(1)).max(SANDBOX_RUN_PROOF_MAX_CHANGED_FILES),
        filesTruncated: z.boolean(),
        summary: z.string().trim().min(1).optional(),
      })
      .strict(),
    validation: z
      .object({
        qualityGate: z.enum(["passed", "failed", "skipped", "unavailable"]),
        checks: z.array(sandboxRunValidationCheckSchema),
      })
      .strict(),
    environment: sandboxRunEnvironmentEvidenceSchema.optional(),
    services: z.array(sandboxRunServiceEvidenceSchema).max(8).optional(),
    delivery: z
      .object({
        policy: sandboxDeliveryPolicySchema.optional(),
        branch: z.string().trim().min(1).optional(),
        commit: z.string().trim().min(1).optional(),
        pullRequestUrl: z.url().optional(),
      })
      .strict(),
    artifacts: z.array(sandboxRunArtifactReferenceSchema),
    usage: z
      .object({
        model: z.object({ id: z.string().trim().min(1) }).strict(),
        infrastructure: z
          .object({
            instanceType: z.string().trim().min(1),
            durationSeconds: z.number().nonnegative(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    residualRisks: z.array(z.string().trim().min(1)),
    incompleteWork: z.array(z.string().trim().min(1)),
  })
  .strict();

export const sandboxRunResultSchema = z
  .object({
    success: z.boolean().optional(),
    summary: z.string().optional(),
    diff: z.string().optional(),
    logs: z.string().optional(),
    logsArtifactKey: z.string().optional(),
    logsArtifactUrl: z.string().optional(),
    error: z.string().optional(),
    errorType: z.string().optional(),
    retryable: z.boolean().optional(),
    branchName: z.string().optional(),
    pullRequestUrl: z.url().optional(),
    proof: sandboxRunProofEvidenceSchema.optional(),
  })
  .catchall(z.unknown());

export const sandboxTaskResultSchema = z
  .object({
    success: z.boolean(),
    logs: z.string(),
    diff: z.string().optional(),
    summary: z.string().optional(),
    error: z.string().optional(),
    errorType: z.string().optional(),
    branchName: z.string().optional(),
    pullRequestUrl: z.url().optional(),
    environmentCache: sandboxEnvironmentCacheRecordSchema.optional(),
    proof: sandboxRunProofEvidenceSchema.optional(),
  })
  .catchall(z.unknown());

export const sandboxPromptStrategySchema = z.enum(SANDBOX_PROMPT_STRATEGIES);

export const sandboxRunEventSchema = z
  .object({
    type: z.string(),
    runId: z.string().optional(),
    repo: z.string().optional(),
    installationId: z.number().int().positive().optional(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
    message: z.string().optional(),
    command: z.string().optional(),
    commandIndex: z.number().optional(),
    commandTotal: z.number().optional(),
    exitCode: z.number().optional(),
    branchName: z.string().optional(),
    commitSha: z.string().optional(),
    targetBranch: z.string().optional(),
    deliveryAction: z.string().optional(),
    pullRequestUrl: z.url().optional(),
    configurationSource: z.enum(["polychat", "repository"]).optional(),
    configurationRevision: z.string().optional(),
    configurationPath: z.string().optional(),
    preparationMode: sandboxEnvironmentPreparationModeSchema.optional(),
    preparationStatus: sandboxEnvironmentPreparationStatusSchema.optional(),
    runtimeRequirements: z.array(sandboxRuntimeRequirementSchema).optional(),
    packageManagerRequirement: sandboxPackageManagerRequirementSchema.optional(),
    durationSeconds: z.number().nonnegative().optional(),
    cacheKey: z.string().optional(),
    cacheStatus: z.enum(["created", "reused", "miss", "failed"]).optional(),
    cacheCreatedAt: z.string().optional(),
    cacheAgeSeconds: z.number().nonnegative().optional(),
    cacheInvalidationReason: z.string().optional(),
    serviceName: sandboxServiceNameSchema.optional(),
    serviceWorkingDirectory: z.string().trim().min(1).optional(),
    serviceStatus: sandboxServiceStatusSchema.optional(),
    servicePort: sandboxServicePortSchema.optional(),
    serviceAction: sandboxServiceActionSchema.optional(),
    serviceRestartCount: z.number().int().nonnegative().optional(),
    serviceHealthPath: z.string().trim().min(1).optional(),
    serviceHealthCheckType: z.enum(["http", "tcp"]).optional(),
    plan: z.string().optional(),
    error: z.string().optional(),
    errorType: z.string().optional(),
    path: z.string().optional(),
    output: z.string().optional(),
    stream: z.enum(["stdout", "stderr"]).optional(),
    language: z.string().optional(),
    changeType: z.string().optional(),
    isDirectory: z.boolean().optional(),
    agentStep: z.number().optional(),
    action: z.string().optional(),
    reasoning: z.string().optional(),
    promptStrategy: sandboxPromptStrategySchema.optional(),
    retryable: z.boolean().optional(),
    commandCount: z.number().optional(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
    truncated: z.boolean().optional(),
    timestamp: z.string().optional(),
    timeoutSeconds: z.number().int().positive().optional(),
    timeoutAt: z.string().optional(),
    result: sandboxRunResultSchema.optional(),
    approvalId: z.string().optional(),
    approvalStatus: z
      .enum(["pending", "escalated", "timed_out", "approved", "rejected"])
      .optional(),
    approvalExpiresAt: z.string().optional(),
    approvalEscalatedAt: z.string().optional(),
    approvalTimedOutAt: z.string().optional(),
    instructionId: z.string().optional(),
    instructionKind: sandboxRunInstructionKindSchema.optional(),
    instructionContent: z.string().optional(),
    createdByUserId: z.number().int().positive().optional(),
    repeatCount: z.number().int().positive().optional(),
    maxSteps: z.number().int().positive().optional(),
    extendedBy: z.number().int().positive().optional(),
  })
  .catchall(z.unknown());

export const sandboxRunDataSchema = z.object({
  runId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  installationId: z.number().int().positive(),
  repo: sandboxRepoSchema,
  task: z.string().trim().min(1),
  taskType: z.enum(SANDBOX_TASK_TYPES).optional(),
  model: z.string().trim().min(1),
  trustLevel: z.enum(SANDBOX_TRUST_LEVELS).optional(),
  promptStrategy: sandboxPromptStrategySchema.optional(),
  deliveryPolicy: sandboxDeliveryPolicySchema.optional(),
  shouldCommit: z.boolean().optional(),
  environmentSetup: sandboxEnvironmentSetupSchema.optional(),
  environmentPreparationMode: sandboxEnvironmentPreparationModeSchema.optional(),
  environmentCacheGeneration: z.number().int().nonnegative().optional(),
  status: sandboxRunStatusSchema,
  startedAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  completedAt: z.string().optional(),
  error: z.string().optional(),
  events: z.array(sandboxRunEventSchema).optional(),
  result: sandboxRunResultSchema.optional(),
  manifest: sandboxRunManifestSchema.optional(),
  infrastructureUsage: z
    .object({
      instanceType: z.string().trim().min(1),
      durationSeconds: z.number().nonnegative(),
    })
    .strict()
    .optional(),
  cancelRequestedAt: z.string().optional(),
  cancellationReason: z.string().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  timeoutAt: z.string().optional(),
  pausedAt: z.string().optional(),
  resumedAt: z.string().optional(),
  pauseReason: z.string().optional(),
  resumeReason: z.string().optional(),
  artifactKey: z.string().optional(),
  artifactUrl: z.string().optional(),
  workflowPhase: z
    .enum(["queued", "dispatching", "executing", "finalizing", "completed", "failed", "cancelled"])
    .optional(),
  queueDispatchedAt: z.string().optional(),
  processingStartedAt: z.string().optional(),
});

export const sandboxRunDetailSchema = z.object({
  run: sandboxRunDataSchema,
  createdByUserId: z.number().int().positive(),
  projectId: z.string().nullable(),
  conversationId: z.string().nullable(),
});

export type SandboxRunDetail = z.infer<typeof sandboxRunDetailSchema>;

export const sandboxTaskTypeSchema = z.enum(SANDBOX_TASK_TYPES);
export const sandboxTrustLevelSchema = z.enum(SANDBOX_TRUST_LEVELS);

export const sandboxRequestOptionsSchema = z
  .object({
    enabled: z.boolean(),
    repo: z.string().trim().optional(),
    installationId: z.number().int().positive().optional(),
    model: z.string().trim().min(1).optional(),
    taskType: sandboxTaskTypeSchema.optional(),
    promptStrategy: sandboxPromptStrategySchema.optional(),
    deliveryPolicy: sandboxDeliveryPolicySchema.optional(),
    shouldCommit: z.boolean().optional(),
    environmentSetup: sandboxEnvironmentSetupSchema.optional(),
    timeoutSeconds: z.number().int().positive().optional(),
    maxSteps: z.number().int().positive().optional(),
    modelSettings: sandboxModelSettingsSchema.optional(),
  })
  .passthrough();

export type SandboxRequestOptions = z.infer<typeof sandboxRequestOptionsSchema>;

export const sandboxRunControlStateSchema = z.enum(["queued", "running", "paused", "cancelled"]);

export const sandboxRunControlActionSchema = z.enum(["pause", "resume", "cancel"]);

export const updateSandboxRunControlSchema = z
  .object({
    action: sandboxRunControlActionSchema,
    reason: z.string().trim().min(1).max(500).optional(),
    expectedUpdatedAt: z.string().trim().min(1),
  })
  .strict();

export const sandboxRunControlSchema = z.object({
  runId: z.string().trim().min(1),
  state: sandboxRunControlStateSchema,
  updatedAt: z.string().trim().min(1),
  cancellationReason: z.string().optional(),
  pauseReason: z.string().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  timeoutAt: z.string().optional(),
});

export const sandboxRunInstructionSchema = z.object({
  id: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
  runId: z.string().trim().min(1),
  kind: sandboxRunInstructionKindSchema,
  content: z.string().optional(),
  command: z.string().optional(),
  requestId: z.string().optional(),
  approvalStatus: z.enum(["pending", "escalated", "timed_out", "approved", "rejected"]).optional(),
  serviceName: sandboxServiceNameSchema.optional(),
  serviceAction: sandboxServiceActionSchema.optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  escalateAfterSeconds: z.number().int().positive().optional(),
  expiresAt: z.string().optional(),
  escalationAt: z.string().optional(),
  escalatedAt: z.string().optional(),
  timedOutAt: z.string().optional(),
  resolvedAt: z.string().optional(),
  resolutionReason: z.string().optional(),
  createdByUserId: z.number().int().positive().optional(),
  createdAt: z.string().trim().min(1),
});

export const sandboxRunInstructionEnvelopeSchema = z.object({
  index: z.number().int().positive(),
  recordedAt: z.string().trim().min(1),
  instruction: sandboxRunInstructionSchema,
});

export const sandboxRunEventEnvelopeSchema = z.object({
  index: z.number().int().positive(),
  recordedAt: z.string().trim().min(1),
  event: sandboxRunEventSchema,
});

export const sandboxWorkerExecuteRequestSchema = z.object({
  userId: z.number().int().positive(),
  projectId: z.string().trim().min(1).optional(),
  taskType: sandboxTaskTypeSchema.optional(),
  repo: sandboxRepoSchema,
  task: z.string().trim().min(1),
  model: z.string().trim().min(1).optional(),
  promptStrategy: sandboxPromptStrategySchema.optional(),
  deliveryPolicy: sandboxDeliveryPolicySchema.optional(),
  shouldCommit: z.boolean().optional(),
  environmentSetup: sandboxEnvironmentSetupSchema.optional(),
  environmentPreparationMode: sandboxEnvironmentPreparationModeSchema.optional(),
  environmentCache: sandboxEnvironmentCacheRecordSchema.optional(),
  environmentCacheGeneration: z.number().int().nonnegative().optional(),
  timeoutSeconds: z
    .number()
    .int()
    .min(SANDBOX_TIMEOUT_MIN_SECONDS)
    .max(SANDBOX_TIMEOUT_MAX_SECONDS)
    .optional(),
  trustLevel: sandboxTrustLevelSchema.optional(),
  polychatApiUrl: z.url(),
  installationId: z.number().int().positive().optional(),
  runId: z.string().trim().min(1).optional(),
  modelSettings: sandboxModelSettingsSchema.optional(),
});

export const sandboxRunUsageReportSchema = z.object({
  runId: z.string().trim().min(1),
  userId: z.number().int().positive(),
  instanceType: z.string().trim().min(1),
  startedAt: z.string().trim().min(1),
  endedAt: z.string().trim().min(1),
  durationSeconds: z.number().min(0),
});

export type SandboxRunUsageReport = z.infer<typeof sandboxRunUsageReportSchema>;

export type GitHubConnectionPayload = z.infer<typeof githubConnectionSchema>;
export type ExecuteSandboxRunPayload = z.infer<typeof executeSandboxRunSchema>;
export type SandboxRunDispatchPayload = z.infer<typeof sandboxRunDispatchPayloadSchema>;
export type SandboxRunDispatchMessage = z.infer<typeof sandboxRunDispatchMessageSchema>;
export type AutoConnectPayload = z.infer<typeof autoConnectSchema>;
export type SandboxConnectionRepositoriesPayload = z.infer<
  typeof sandboxConnectionRepositoriesSchema
>;
export type { SandboxModelSettings };
export type ListRunInstructionsQueryPayload = z.infer<typeof listRunInstructionsQuerySchema>;
export type SubmitRunInstructionPayload = z.infer<typeof submitRunInstructionSchema>;

export type SandboxConnection = z.infer<typeof sandboxConnectionSchema>;
export type SandboxInstallConfig = z.infer<typeof sandboxInstallConfigSchema>;
export type SandboxRunStatus = z.infer<typeof sandboxRunStatusSchema>;
export type SandboxRunTerminalStatus = z.infer<typeof sandboxRunTerminalStatusSchema>;
export type SandboxRunValidationCheck = z.infer<typeof sandboxRunValidationCheckSchema>;
export type SandboxRunEnvironmentEvidence = z.infer<typeof sandboxRunEnvironmentEvidenceSchema>;
export type SandboxRunProofEvidence = z.infer<typeof sandboxRunProofEvidenceSchema>;
export type SandboxRunArtifactReference = z.infer<typeof sandboxRunArtifactReferenceSchema>;
export type SandboxRunManifestOutcome = z.infer<typeof sandboxRunManifestOutcomeSchema>;
export type SandboxRunManifest = z.infer<typeof sandboxRunManifestSchema>;
export type SandboxRunResult = z.infer<typeof sandboxRunResultSchema>;
export type SandboxTaskResult = z.infer<typeof sandboxTaskResultSchema>;
export type SandboxRunEvent = z.infer<typeof sandboxRunEventSchema>;
export type SandboxRunData = z.infer<typeof sandboxRunDataSchema>;
export type { SandboxPromptStrategy, SandboxTaskType, SandboxTrustLevel };
export type SandboxWebhookCommand = z.infer<typeof sandboxWebhookCommandSchema>;
export type SandboxRunControlState = z.infer<typeof sandboxRunControlStateSchema>;
export type SandboxRunControlAction = z.infer<typeof sandboxRunControlActionSchema>;
export type UpdateSandboxRunControl = z.infer<typeof updateSandboxRunControlSchema>;
export type SandboxRunControl = z.infer<typeof sandboxRunControlSchema>;
export type SandboxRunInstructionKind = z.infer<typeof sandboxRunInstructionKindSchema>;
export type SandboxRunInstruction = z.infer<typeof sandboxRunInstructionSchema>;
export type SandboxRunInstructionEnvelope = z.infer<typeof sandboxRunInstructionEnvelopeSchema>;
export type SandboxRunEventEnvelope = z.infer<typeof sandboxRunEventEnvelopeSchema>;
export type SandboxWorkerExecuteRequest = z.infer<typeof sandboxWorkerExecuteRequestSchema>;

export type CreateSandboxConnectionInput = GitHubConnectionPayload;
export type ConnectSandboxInstallationInput = AutoConnectPayload;
export type ExecuteSandboxRunInput = ExecuteSandboxRunPayload;
