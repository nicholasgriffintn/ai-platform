import z from "zod/v4";

export const PROVIDER_DRIVERS = [
  "anthropic",
  "ollama",
  "lmstudio",
  "llamacpp",
  "claude-code",
  "codex",
  "cursor",
  "grok",
  "opencode",
  "antigravity",
  "polychat-sandbox",
] as const;

export const providerDriverSchema = z.enum(PROVIDER_DRIVERS);

export const providerCapabilitiesSchema = z
  .object({
    streamsText: z.boolean(),
    streamsReasoning: z.boolean(),
    picksOwnModel: z.boolean(),
    listsModels: z.boolean(),
    writesFiles: z.boolean(),
    runsCommands: z.boolean(),
    reportsApprovals: z.boolean(),
    autoReview: z.boolean(),
    resumesSessions: z.boolean(),
    checkpoints: z.boolean(),
    rollsBack: z.boolean(),
  })
  .strict();

export const agentWorkspaceRequirementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("directory") }).strict(),
  z.object({ kind: z.literal("repository") }).strict(),
  z.object({ kind: z.literal("none") }).strict(),
]);

export const permissionModeSchema = z.enum([
  "supervised",
  "auto_accept_edits",
  "auto",
  "full_access",
]);
export const DEFAULT_PERMISSION_MODE = "auto_accept_edits" as const;

export const agentDirectorySchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    label: z.string().min(1).max(120),
    approvedAt: z.string(),
    lastUsedAt: z.string().nullable(),
    isGitRepo: z.boolean(),
  })
  .strict();

export const providerInstanceSchema = z
  .object({
    id: z.string().min(1),
    driver: providerDriverSchema,
    label: z.string().min(1).max(120),
    accountId: z.string().min(1).nullable(),
    capabilities: providerCapabilitiesSchema,
    createdAt: z.string(),
    lastUsedAt: z.string().nullable(),
  })
  .strict();

export const providerAdapterSchema = z
  .object({
    driver: providerDriverSchema,
    instanceId: z.string().min(1),
    capabilities: providerCapabilitiesSchema,
  })
  .strict();

export type ProviderDriver = z.infer<typeof providerDriverSchema>;
export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;
export type AgentWorkspaceRequirement = z.infer<typeof agentWorkspaceRequirementSchema>;
export type PermissionMode = z.infer<typeof permissionModeSchema>;
export type AgentDirectory = z.infer<typeof agentDirectorySchema>;
export type ProviderInstance = z.infer<typeof providerInstanceSchema>;
export type ProviderAdapter = z.infer<typeof providerAdapterSchema>;

const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
  supervised: "Supervised",
  auto_accept_edits: "Auto-accept edits",
  auto: "Auto",
  full_access: "Full access",
};

export function getPermissionModeLabel(mode: PermissionMode): string {
  return PERMISSION_MODE_LABELS[mode];
}

const GATED_PERMISSION_MODES: readonly PermissionMode[] = ["supervised", "auto_accept_edits"];

export function getPermissionModeUnavailableReason(
  capabilities: Pick<ProviderCapabilities, "autoReview" | "reportsApprovals"> | undefined,
  mode: PermissionMode,
  supportedModes: readonly PermissionMode[] = [
    "supervised",
    "auto_accept_edits",
    "auto",
    "full_access",
  ],
): string | undefined {
  if (!capabilities) {
    return undefined;
  }

  if (!supportedModes.includes(mode)) {
    return "This provider does not support that permission mode.";
  }

  if (mode === "auto" && !capabilities.autoReview) {
    return "Auto is unavailable because this provider does not report its own review.";
  }

  if (GATED_PERMISSION_MODES.includes(mode) && !capabilities.reportsApprovals) {
    return "This provider cannot receive approval requests.";
  }

  return undefined;
}

const MODEL_CAPABILITIES: ProviderCapabilities = {
  streamsText: true,
  streamsReasoning: true,
  picksOwnModel: false,
  listsModels: false,
  writesFiles: false,
  runsCommands: false,
  reportsApprovals: false,
  autoReview: false,
  resumesSessions: false,
  checkpoints: false,
  rollsBack: false,
};

const LOCAL_MODEL_CAPABILITIES: ProviderCapabilities = {
  ...MODEL_CAPABILITIES,
  listsModels: true,
};

const AGENT_CAPABILITIES: ProviderCapabilities = {
  streamsText: true,
  streamsReasoning: true,
  picksOwnModel: true,
  listsModels: false,
  writesFiles: true,
  runsCommands: true,
  reportsApprovals: true,
  autoReview: true,
  resumesSessions: true,
  checkpoints: true,
  rollsBack: true,
};

const PROVIDER_CAPABILITIES: Record<ProviderDriver, ProviderCapabilities> = {
  anthropic: MODEL_CAPABILITIES,
  ollama: LOCAL_MODEL_CAPABILITIES,
  lmstudio: LOCAL_MODEL_CAPABILITIES,
  llamacpp: LOCAL_MODEL_CAPABILITIES,
  "claude-code": AGENT_CAPABILITIES,
  codex: AGENT_CAPABILITIES,
  cursor: AGENT_CAPABILITIES,
  grok: AGENT_CAPABILITIES,
  opencode: AGENT_CAPABILITIES,
  antigravity: {
    ...AGENT_CAPABILITIES,
    streamsText: false,
    reportsApprovals: false,
    rollsBack: false,
  },
  "polychat-sandbox": {
    ...AGENT_CAPABILITIES,
    picksOwnModel: false,
  },
};

export function getProviderCapabilities(driver: ProviderDriver): ProviderCapabilities {
  return { ...PROVIDER_CAPABILITIES[driver] };
}
