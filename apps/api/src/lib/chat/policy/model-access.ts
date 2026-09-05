import {
  getModelInputModalities,
  type ModelConfigItem,
  type ModelModality,
  type ModelTier,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";

import {
  filterModelsForUserAccess,
  getLineupModelsForUser,
  getModels,
} from "~/lib/providers/models";
import {
  getExecutableModelsForAccount,
  getModelCredentialAuthority,
  resolveTierAlternateModel,
  resolveTierModel,
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

const ATTACHMENT_INPUT_MODALITIES: Partial<Record<Attachment["type"], ModelModality>> = {
  image: "image",
  document: "pdf",
  audio: "audio",
  video: "video",
};

function requiredInputModalities(attachments: Attachment[]): ModelModality[] {
  const required = new Set<ModelModality>();

  for (const attachment of attachments) {
    const modality = ATTACHMENT_INPUT_MODALITIES[attachment.type];

    if (modality) {
      required.add(modality);
    }
  }

  return [...required];
}

function supportsRequiredInputs(model: ModelConfigItem, required: ModelModality[]) {
  const inputs = getModelInputModalities(model);

  return required.every((modality) => {
    if (modality === "pdf") {
      return (
        model.supportsDocuments === true || inputs.includes("pdf") || inputs.includes("document")
      );
    }

    if (modality === "image") {
      return model.multimodal === true || inputs.includes("image");
    }

    return inputs.includes(modality);
  });
}

export interface SelectModelsRequest {
  env: IEnv;
  user?: IUser;
  attachments: Attachment[];
  tier: ModelTier;
  requestedModel?: string;
  requestedModels?: string[];
  requestedProvider?: string;
  useMultiModel?: boolean;
}

export interface SelectedModels {
  models: string[];
  reasoningEffort?: ReasoningEffort;
}

export async function selectModels({
  env,
  user,
  attachments,
  tier,
  requestedModel,
  requestedModels,
  requestedProvider,
  useMultiModel,
}: SelectModelsRequest): Promise<SelectedModels> {
  const explicitModels = normaliseExplicitModels(requestedModels);

  if (explicitModels.length) {
    await assertExplicitModelsAccessible(env, user, explicitModels, requestedProvider);

    return { models: explicitModels };
  }

  if (requestedModel) {
    await assertExplicitModelsAccessible(env, user, [requestedModel], requestedProvider);

    return { models: [requestedModel] };
  }

  const availableModels = await getLineupModelsForUser(env, user);
  const required = requiredInputModalities(attachments);
  const options = {
    isEligible: (model: ModelConfigItem) =>
      supportsRequiredInputs(model, required) &&
      (!requestedProvider || model.provider === requestedProvider),
  };
  const primary = resolveTierModel(availableModels, user, tier, "agent", options);

  if (!primary) {
    throw new AssistantError(
      `No model in the ${tier} tier is available for this account${
        required.length ? ` with ${required.join(", ")} input` : ""
      }`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const alternate = useMultiModel
    ? resolveTierAlternateModel(availableModels, user, tier, "agent", primary, options)
    : null;

  return {
    models: alternate ? [primary.id, alternate.id] : [primary.id],
    reasoningEffort: primary.effort,
  };
}
