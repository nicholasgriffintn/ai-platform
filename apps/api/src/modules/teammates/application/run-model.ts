import {
  DEFAULT_MODEL_TIER,
  isPolyTeammateId,
  type ModelConfigItem,
  type ResponseSettings,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Teammate } from "~/infrastructure/database/schema";
import { findLatestUserMessage } from "~/modules/conversations/domain/latest-user-message";
import { selectModels } from "~/modules/models/application/access";
import { findModelConfig, requireSystemModel } from "~/modules/models/application/resolve";
import { getAllAttachments } from "~/modules/responses/application/engine/messages/attachments";
import type { ResponseCommand } from "~/modules/responses/domain/command";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";

interface TeammateRunModel {
  modelId: string;
  config: ModelConfigItem;
  settings: Pick<ResponseSettings, "model" | "provider" | "model_tier" | "reasoning_effort">;
}

export async function resolveTeammateRunModel({
  context,
  teammate,
  settings,
  messages,
  workspaceId,
}: {
  context: ServiceContext;
  teammate: Pick<Teammate, "id" | "model">;
  settings: ResponseSettings;
  messages: ResponseCommand["messages"];
  workspaceId?: string;
}): Promise<TeammateRunModel> {
  let modelId = teammate.model || settings.model || settings.models?.[0];
  let provider = teammate.model ? undefined : settings.provider;
  let reasoningEffort = settings.reasoning_effort;
  let tier = settings.model_tier;

  if (!modelId && (isPolyTeammateId(teammate.id) || tier)) {
    const defaults = await getRequestUserSettings(context);

    modelId = tier ? undefined : (defaults?.default_model_id ?? undefined);
    provider = settings.model_tier ? settings.provider : undefined;

    if (!modelId) {
      tier ??= defaults?.default_model_tier ?? DEFAULT_MODEL_TIER;
      const latestUserMessage = findLatestUserMessage(messages);
      const content = latestUserMessage ? messages[latestUserMessage.index]?.content : undefined;
      const { allAttachments } = getAllAttachments(Array.isArray(content) ? content : []);
      const selected = await selectModels({
        env: context.env,
        user: context.user ?? undefined,
        attachments: allAttachments,
        tier,
        requestedProvider: provider,
        useMultiModel: settings.use_multi_model,
      });

      modelId = selected.models[0];
    }
  } else if (!modelId) {
    const selected = await requireSystemModel(context.env, context.user ?? undefined, "routines", {
      workspaceId,
    });

    modelId = selected.id;
    provider = selected.provider;
    reasoningEffort ??= selected.effort;
  }

  const config = await findModelConfig(modelId, context.env, provider, context.user?.id);

  if (!config) {
    throw new AssistantError("Invalid model", ErrorType.PARAMS_ERROR);
  }

  const usesModelTier =
    tier !== undefined && !teammate.model && !settings.model && !settings.models?.length;

  return {
    modelId,
    config,
    settings: {
      model: usesModelTier ? undefined : modelId,
      provider: usesModelTier ? provider : config.provider,
      model_tier: tier,
      reasoning_effort: reasoningEffort,
    },
  };
}
