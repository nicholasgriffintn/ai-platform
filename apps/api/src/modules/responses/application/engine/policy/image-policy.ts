import type { ModelConfigInfo, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { hasAnyEnabledTool } from "@ngriffin_uk/polychat-utility-server/enabled-tools";

import { enforceImagePolicy } from "~/modules/generate/application/image-policy";
import { producesVisualMedia } from "~/modules/generate/domain/image-policy";
import { getModelConfigByMatchingModel } from "~/modules/models/application/resolve";
import { getAllAttachments } from "~/modules/responses/application/engine/messages/attachments";
import type { CoreChatOptions, Message } from "~/types";

export interface ChatImagePolicyRequest {
  options: Pick<CoreChatOptions, "completion_id" | "context" | "env">;
  primaryModelConfig?: ModelConfigItem;
  modelConfigs: readonly ModelConfigInfo[];
  enabledTools: readonly string[];
  messages: readonly Message[];
  messageWithContext: string;
}

async function canGenerateVisualMedia(request: ChatImagePolicyRequest): Promise<boolean> {
  const { enabledTools, modelConfigs, options, primaryModelConfig } = request;

  if (
    primaryModelConfig &&
    (producesVisualMedia(primaryModelConfig) ||
      (primaryModelConfig.supportsImageGenerationTool &&
        hasAnyEnabledTool(enabledTools, "image_generation")))
  ) {
    return true;
  }

  const configs = await Promise.all(
    modelConfigs
      .filter(
        ({ model, provider }) =>
          model !== primaryModelConfig?.matchingModel || provider !== primaryModelConfig.provider,
      )
      .map(({ model, provider }) =>
        getModelConfigByMatchingModel(model, options.env, provider, options.context?.user?.id),
      ),
  );

  return configs.some((config) => config && producesVisualMedia(config));
}

export async function enforceChatImagePolicy(request: ChatImagePolicyRequest): Promise<void> {
  if (!(await canGenerateVisualMedia(request))) {
    return;
  }

  const { messages, messageWithContext, options } = request;
  const lastContent = messages.at(-1)?.content;
  const images = getAllAttachments(
    Array.isArray(lastContent) ? lastContent : [],
  ).imageAttachments.flatMap((image) => (image.url ? [image.url] : []));

  if (!messageWithContext && images.length === 0) {
    return;
  }

  await enforceImagePolicy({
    env: options.env,
    user: options.context?.user,
    completionId: options.completion_id,
    surface: "chat",
    text: messageWithContext,
    images,
  });
}
