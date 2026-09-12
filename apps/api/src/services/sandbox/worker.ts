import type {
  SandboxExecutionProvider,
  SandboxWorkerExecuteRequest,
} from "@ngriffin_uk/polychat-schemas";

import { resolveProjectDefaultModelTier } from "~/lib/chat/policy/project-model-tier";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { SandboxProviderExecuteOptions } from "~/lib/providers/capabilities/sandbox";
import { filterModelsForUserAccess, getModels } from "~/lib/providers/models";
import { getExecutableModelsForAccount, resolveTierModel } from "~/lib/providers/models/policy";
import { resolveSandboxApiBaseUrl } from "~/services/apps/sandbox/urls";
import { generateJwtToken } from "~/services/auth/jwt";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const SANDBOX_TOKEN_EXPIRATION_SECONDS = 60 * 60;

function parseModelPolicyList(input: string | undefined): Set<string> {
  if (!input?.trim()) {
    return new Set();
  }

  return new Set(
    input
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.toLowerCase()),
  );
}

function enforceSandboxModelPolicy(env: IEnv, model: string): string {
  const normalisedModel = model.trim();
  const lower = normalisedModel.toLowerCase();
  const blockedModels = parseModelPolicyList(env.SANDBOX_BLOCKED_MODELS);

  if (blockedModels.has(lower)) {
    throw new AssistantError(
      `Sandbox model "${normalisedModel}" is blocked by policy`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const allowedModels = parseModelPolicyList(env.SANDBOX_ALLOWED_MODELS);

  if (allowedModels.size > 0 && !allowedModels.has(lower)) {
    throw new AssistantError(
      `Sandbox model "${normalisedModel}" is not allowed by policy`,
      ErrorType.PARAMS_ERROR,
    );
  }

  return normalisedModel;
}

export interface ExecuteSandboxWorkerOptions extends SandboxProviderExecuteOptions {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
}

export async function resolveSandboxModel(params: {
  context: ServiceContext;
  user: IUser;
  model?: string;
  projectId?: string;
  executionProvider?: SandboxExecutionProvider;
}): Promise<string> {
  const { context, user, model, projectId, executionProvider = "polychat" } = params;
  const settings = await context.repositories.userSettings.getUserSettings(user.id);
  const explicitModel = model?.trim();
  const requestedModel = explicitModel || settings?.sandbox_model?.trim();
  const visibleModels = await filterModelsForUserAccess(getModels(), context.env, user.id, {
    shouldUseCache: false,
  });
  const executableModels = Object.fromEntries(
    Object.entries(getExecutableModelsForAccount(visibleModels, user)).filter(
      ([, config]) => executionProvider !== "openai" || config.provider === "openai",
    ),
  );

  if (requestedModel) {
    const selected = Object.entries(executableModels).find(
      ([modelId, config]) => modelId === requestedModel || config.matchingModel === requestedModel,
    );

    if (!selected && (explicitModel || executionProvider === "polychat")) {
      throw new AssistantError(
        `Sandbox model "${requestedModel}" is not available for this account`,
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    if (selected) {
      return enforceSandboxModelPolicy(context.env, selected[0]);
    }
  }

  const tier = await resolveProjectDefaultModelTier(context, projectId);
  const selected = resolveTierModel(executableModels, user, tier, "coding");

  if (!selected) {
    throw new AssistantError(
      "No active sandbox model is available for this account",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return enforceSandboxModelPolicy(context.env, selected.id);
}

export async function executeSandboxWorker(
  options: ExecuteSandboxWorkerOptions,
): Promise<Response> {
  const {
    env,
    context,
    user,
    repo,
    task,
    taskType,
    promptStrategy,
    deliveryPolicy,
    shouldCommit,
    environmentSetup,
    environmentPreparationMode,
    environmentCache,
    environmentCacheGeneration,
    environmentVariables,
    credentialBroker,
    projectId,
    timeoutSeconds,
    inspectionWindowSeconds,
    trustLevel,
    modelSettings,
    installationId,
    stream,
    runId,
    signal,
  } = options;

  if (!env.SANDBOX_WORKER) {
    throw new AssistantError("Sandbox worker not available", ErrorType.NOT_FOUND);
  }

  if (!env.JWT_SECRET) {
    throw new AssistantError("JWT secret not configured", ErrorType.CONFIGURATION_ERROR);
  }

  const model = await resolveSandboxModel({
    context,
    user,
    model: options.model,
    projectId,
    executionProvider: "polychat",
  });
  const sandboxToken = await generateJwtToken(
    user,
    env.JWT_SECRET,
    SANDBOX_TOKEN_EXPIRATION_SECONDS,
  );

  const workerPayload: SandboxWorkerExecuteRequest = {
    userId: user.id,
    projectId,
    taskType: taskType || "feature-implementation",
    repo,
    task,
    model,
    promptStrategy,
    deliveryPolicy,
    shouldCommit,
    environmentSetup,
    environmentPreparationMode,
    environmentCache,
    environmentCacheGeneration,
    environmentVariables,
    credentialBroker,
    timeoutSeconds,
    inspectionWindowSeconds,
    trustLevel,
    modelSettings,
    polychatApiUrl: resolveSandboxApiBaseUrl(env),
    installationId,
    runId,
  };

  const response = await env.SANDBOX_WORKER.fetch(
    new Request("http://sandbox/execute", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sandboxToken}`,
        ...(stream ? { Accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify(workerPayload),
    }),
  );

  return response;
}
