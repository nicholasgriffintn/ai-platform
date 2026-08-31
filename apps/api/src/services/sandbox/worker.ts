import type {
  SandboxPromptStrategy,
  SandboxTaskType,
  SandboxTrustLevel,
  SandboxModelSettings,
  SandboxWorkerExecuteRequest,
} from "@ngriffin_uk/polychat-schemas";
import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getGitHubAppInstallationToken } from "~/lib/github";
import { filterModelsForUserAccess, getModels } from "~/lib/providers/models";
import { getExecutableModelsForAccount, resolvePolicyModel } from "~/lib/providers/models/policy";
import { generateJwtToken } from "~/services/auth/jwt";
import {
  getGitHubAppConnectionForUserInstallation,
  getGitHubAppConnectionForUserRepo,
} from "~/services/github/connections";
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

export interface ExecuteSandboxWorkerOptions {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  repo: string;
  task: string;
  model?: string;
  taskType?: SandboxTaskType;
  promptStrategy?: SandboxPromptStrategy;
  shouldCommit?: boolean;
  timeoutSeconds?: number;
  trustLevel?: SandboxTrustLevel;
  modelSettings?: SandboxModelSettings;
  installationId?: number;
  stream?: boolean;
  runId?: string;
  githubTokenOverride?: string;
  signal?: AbortSignal;
}

export function resolveApiBaseUrl(env: IEnv): string {
  const apiBaseUrl = env.API_BASE_URL?.trim();

  return apiBaseUrl || "https://api.polychat.app";
}

export async function resolveSandboxModel(params: {
  context: ServiceContext;
  user: IUser;
  model?: string;
}): Promise<string> {
  const { context, user, model } = params;
  const settings = await context.repositories.userSettings.getUserSettings(user.id);
  const requestedModel = model?.trim() || settings?.sandbox_model?.trim();
  const visibleModels = await filterModelsForUserAccess(getModels(), context.env, user.id, {
    shouldUseCache: false,
  });
  const executableModels = getExecutableModelsForAccount(visibleModels, user);

  if (requestedModel) {
    const selected = Object.entries(executableModels).find(
      ([modelId, config]) => modelId === requestedModel || config.matchingModel === requestedModel,
    );

    if (!selected) {
      throw new AssistantError(
        `Sandbox model "${requestedModel}" is not available for this account`,
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    return enforceSandboxModelPolicy(context.env, selected[0]);
  }

  const selected = resolvePolicyModel(executableModels, MODEL_DEFAULTS.sandbox, user);

  if (!selected) {
    throw new AssistantError(
      "No active sandbox model is available for this account",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return enforceSandboxModelPolicy(context.env, selected.id);
}

async function resolveGitHubToken(params: {
  context: ServiceContext;
  userId: number;
  repo: string;
  installationId?: number;
  githubTokenOverride?: string;
}): Promise<string> {
  const { context, userId, repo, installationId, githubTokenOverride } = params;

  if (githubTokenOverride?.trim()) {
    return githubTokenOverride.trim();
  }

  const githubConnection = installationId
    ? await getGitHubAppConnectionForUserInstallation(context, userId, installationId)
    : await getGitHubAppConnectionForUserRepo(context, userId, repo);

  return getGitHubAppInstallationToken({
    appId: githubConnection.appId,
    privateKey: githubConnection.privateKey,
    installationId: githubConnection.installationId,
  });
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
    shouldCommit,
    timeoutSeconds,
    trustLevel,
    modelSettings,
    installationId,
    stream,
    runId,
    githubTokenOverride,
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
  });
  const sandboxToken = await generateJwtToken(
    user,
    env.JWT_SECRET,
    SANDBOX_TOKEN_EXPIRATION_SECONDS,
  );

  const githubToken = await resolveGitHubToken({
    context,
    userId: user.id,
    repo,
    installationId,
    githubTokenOverride,
  });
  const workerPayload: SandboxWorkerExecuteRequest = {
    userId: user.id,
    taskType: taskType || "feature-implementation",
    repo,
    task,
    model,
    promptStrategy,
    shouldCommit: Boolean(shouldCommit),
    timeoutSeconds,
    trustLevel,
    modelSettings,
    polychatApiUrl: resolveApiBaseUrl(env),
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
        "X-GitHub-Token": githubToken,
        ...(stream ? { Accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify(workerPayload),
    }),
  );

  return response;
}
