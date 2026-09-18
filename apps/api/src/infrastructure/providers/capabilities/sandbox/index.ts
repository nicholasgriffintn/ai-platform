import {
  sandboxDeliveryPolicyCreatesCommit,
  type SandboxCredentialBrokerAccess,
  type SandboxDeliveryPolicy,
  type SandboxEnvironmentCacheRecord,
  type SandboxEnvironmentPreparationMode,
  type SandboxEnvironmentSetup,
  type SandboxExecutionProvider,
  type SandboxModelSettings,
  type SandboxPromptStrategy,
  type SandboxProviderCapabilities,
  type SandboxTaskType,
  type SandboxTrustLevel,
} from "@ngriffin_uk/polychat-schemas";

export interface SandboxProviderExecuteOptions {
  repo: string;
  task: string;
  model?: string;
  taskType?: SandboxTaskType;
  promptStrategy?: SandboxPromptStrategy;
  deliveryPolicy?: SandboxDeliveryPolicy;
  shouldCommit?: boolean;
  environmentSetup?: SandboxEnvironmentSetup;
  environmentPreparationMode?: SandboxEnvironmentPreparationMode;
  environmentCache?: SandboxEnvironmentCacheRecord;
  environmentCacheGeneration?: number;
  environmentVariables?: Record<string, string>;
  credentialBroker: SandboxCredentialBrokerAccess;
  projectId?: string;
  timeoutSeconds?: number;
  inspectionWindowSeconds?: number;
  trustLevel?: SandboxTrustLevel;
  modelSettings?: SandboxModelSettings;
  installationId?: number;
  stream?: boolean;
  runId?: string;
  signal?: AbortSignal;
}

export interface SandboxProvider {
  name: SandboxExecutionProvider;
  capabilities: SandboxProviderCapabilities;
  execute(options: SandboxProviderExecuteOptions): Promise<Response>;
}

export function executeSandboxProvider(
  provider: SandboxProvider,
  options: SandboxProviderExecuteOptions,
): Promise<Response> {
  if (!provider.capabilities.credentialBroker) {
    throw new Error(`Sandbox provider "${provider.name}" does not support credential brokering`);
  }

  if (options.environmentSetup && !provider.capabilities.environmentSetup) {
    throw new Error(`Sandbox provider "${provider.name}" does not support environment setup`);
  }

  if (
    options.deliveryPolicy &&
    sandboxDeliveryPolicyCreatesCommit(options.deliveryPolicy) &&
    !provider.capabilities.remoteDelivery
  ) {
    throw new Error(`Sandbox provider "${provider.name}" does not support remote delivery`);
  }

  if ((options.inspectionWindowSeconds ?? 0) > 0 && !provider.capabilities.inspection) {
    throw new Error(`Sandbox provider "${provider.name}" does not support post-run inspection`);
  }

  return provider.execute({
    ...options,
    environmentCache: provider.capabilities.environmentCache ? options.environmentCache : undefined,
    environmentCacheGeneration: provider.capabilities.environmentCache
      ? options.environmentCacheGeneration
      : undefined,
  });
}

export * from "./providers";
