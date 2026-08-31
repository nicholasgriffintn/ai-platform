import type { ModelConfigItem, ModelRouterMode } from "@ngriffin_uk/polychat-schemas";

import { ModelRouter } from "~/lib/modelRouter";
import { filterModelsForUserAccess, getModels } from "~/lib/providers/models";
import {
  getExecutableModelsForAccount,
  getModelCredentialAuthority,
} from "~/lib/providers/models/policy";
import type { Attachment, CredentialAuthority, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

function normaliseExplicitModels(requestedModels?: string[]): string[] {
  const explicitModels = requestedModels
    ?.map((model) => model.trim())
    .filter((model) => model.length > 0);

  return explicitModels?.length ? [...new Set(explicitModels)] : [];
}

type ExecutableModelCapability =
  | "supportsApplyEdit"
  | "supportsFim"
  | "supportsNextEdit"
  | "supportsTokenCounting";

interface ResolveExecutableModelRequest {
  env: IEnv;
  user?: IUser;
  model: string;
  provider?: string;
  capability?: ExecutableModelCapability;
}

function resolveExecutableModelFromCatalogue(
  accessibleModels: Record<string, ModelConfigItem>,
  requestedModel: string,
  requestedProvider?: string,
): { id: string; config: ModelConfigItem } | null {
  const directMatch = accessibleModels[requestedModel];

  if (directMatch && (!requestedProvider || directMatch.provider === requestedProvider)) {
    return { id: requestedModel, config: directMatch };
  }

  const matchingEntries = Object.entries(accessibleModels).filter(
    ([, config]) =>
      config.matchingModel === requestedModel &&
      (!requestedProvider || config.provider === requestedProvider),
  );

  // An upstream identifier shared by providers is not an authorisation identity.
  return matchingEntries.length === 1
    ? { id: matchingEntries[0][0], config: matchingEntries[0][1] }
    : null;
}

export async function resolveExecutableModelForRequest({
  env,
  user,
  model,
  provider,
  capability,
}: ResolveExecutableModelRequest): Promise<{
  id: string;
  config: ModelConfigItem;
  credentialAuthority: CredentialAuthority;
}> {
  const visibleModels = await filterModelsForUserAccess(
    getModels({ shouldUseCache: false }),
    env,
    user?.id,
    { shouldUseCache: false },
  );
  const executableModels = getExecutableModelsForAccount(visibleModels, user);
  const resolved = resolveExecutableModelFromCatalogue(executableModels, model, provider);

  if (!resolved || (capability && !resolved.config[capability])) {
    throw new AssistantError(
      `Model not found or user does not have access: ${model}`,
      user ? ErrorType.AUTHORISATION_ERROR : ErrorType.AUTHENTICATION_ERROR,
      403,
    );
  }

  return {
    ...resolved,
    credentialAuthority: getModelCredentialAuthority(resolved.config, user),
  };
}

async function assertExplicitModelsAccessible(
  env: IEnv,
  user: IUser | undefined,
  explicitModels: string[],
  requestedProvider?: string,
): Promise<void> {
  await Promise.all(
    explicitModels.map((model) =>
      resolveExecutableModelForRequest({
        env,
        user,
        model,
        provider: requestedProvider,
      }),
    ),
  );
}

/**
 * Chooses one or multiple models based on flags and user request.
 * @param env - The environment variables
 * @param lastMessageText - The last message text
 * @param attachments - The attachments
 * @param budgetConstraint - The budget constraint
 * @param user - The user
 * @param completionId - The completion ID
 * @param requestedModel - The requested model
 * @param use_multi_model - Whether to use multiple models
 * @param requestedModels - Explicit model IDs requested by the caller
 * @param requestedProvider - Optional provider constraint for requested models
 * @param routerMode - Automatic router mode used when no explicit model is requested
 * @returns The selected models
 */
export async function selectModels(
  env: IEnv,
  lastMessageText: string,
  attachments: Attachment[],
  budgetConstraint: number | undefined,
  user: IUser | undefined,
  completionId: string,
  requestedModel?: string,
  use_multi_model?: boolean,
  requestedModels?: string[],
  requestedProvider?: string,
  routerMode: ModelRouterMode = "auto",
): Promise<string[]> {
  const explicitModels = normaliseExplicitModels(requestedModels);

  if (explicitModels.length) {
    await assertExplicitModelsAccessible(env, user, explicitModels, requestedProvider);

    return explicitModels;
  }

  if (requestedModel) {
    await assertExplicitModelsAccessible(env, user, [requestedModel], requestedProvider);

    return [requestedModel];
  }

  if (use_multi_model && !requestedModel) {
    return ModelRouter.selectMultipleModels(
      env,
      lastMessageText,
      attachments,
      budgetConstraint,
      user,
      completionId,
      routerMode,
    );
  }

  const model = await ModelRouter.selectModel(
    env,
    lastMessageText,
    attachments,
    budgetConstraint,
    user,
    completionId,
    routerMode,
  );

  return [model];
}
