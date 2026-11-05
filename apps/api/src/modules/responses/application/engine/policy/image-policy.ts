import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigInfo, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { hasAnyEnabledTool } from "@ngriffin_uk/polychat-utility-server/enabled-tools";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";

import { enforceImagePolicy } from "~/modules/generate/application/image-policy";
import { producesVisualMedia } from "~/modules/generate/domain/image-policy";
import { getModelConfigByMatchingModel } from "~/modules/models/application/resolve";
import { getAllAttachments } from "~/modules/responses/application/engine/messages/attachments";
import type { CoreChatOptions } from "~/types";

const logger = getLogger({ prefix: "responses/image-policy" });

const HISTORY_TURNS = 12;
const HISTORY_TURN_CHARACTERS = 4000;
const MAX_SCREENED_IMAGES = 12;
const MAX_SCREENED_VIDEOS = 2;

export interface ImagePolicyMessage {
  role: string;
  content: unknown;
}

export interface ChatImagePolicyRequest {
  options: Pick<CoreChatOptions, "completion_id" | "context" | "env">;
  primaryModelConfig?: ModelConfigItem;
  modelConfigs: readonly ModelConfigInfo[];
  enabledTools: readonly string[];
  messages: readonly ImagePolicyMessage[];
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

function readConversationWindow(messages: readonly ImagePolicyMessage[]) {
  const turns = messages
    .filter(({ role }) => role === "user" || role === "assistant")
    .slice(-HISTORY_TURNS);
  const media = turns
    .filter(({ role }) => role === "user")
    .reverse()
    .map(({ content }) => getAllAttachments(Array.isArray(content) ? content : []));

  return {
    history: turns.slice(0, -1).flatMap(({ content, role }) => {
      const text = extractTextFromMessageContent(content).slice(0, HISTORY_TURN_CHARACTERS);

      return text ? [{ role, text }] : [];
    }),
    images: [
      ...new Set(
        media.flatMap(({ imageAttachments }) =>
          imageAttachments.flatMap(({ url }) => (url ? [url] : [])),
        ),
      ),
    ].slice(0, MAX_SCREENED_IMAGES),
    videos: [
      ...new Set(
        media.flatMap(({ videoAttachments }) =>
          videoAttachments.flatMap(({ url }) => (url ? [url] : [])),
        ),
      ),
    ].slice(0, MAX_SCREENED_VIDEOS),
  };
}

export async function enforceChatImagePolicy(request: ChatImagePolicyRequest): Promise<void> {
  if (!(await canGenerateVisualMedia(request))) {
    return;
  }

  const { messages, messageWithContext, options } = request;
  const conversation = readConversationWindow(messages);

  if (
    !messageWithContext &&
    conversation.history.length === 0 &&
    conversation.images.length === 0 &&
    conversation.videos.length === 0
  ) {
    return;
  }

  await enforceImagePolicy({
    env: options.env,
    user: options.context?.user,
    completionId: options.completion_id,
    surface: "chat",
    text: messageWithContext,
    ...conversation,
  });
}

export async function screenActivatedImageTool(
  request: ChatImagePolicyRequest,
  activatedToolNames: readonly string[],
): Promise<string[]> {
  if (!hasAnyEnabledTool(activatedToolNames, "image_generation")) {
    return [...activatedToolNames];
  }

  try {
    await enforceChatImagePolicy({
      ...request,
      enabledTools: [...request.enabledTools, ...activatedToolNames],
    });

    return [...activatedToolNames];
  } catch (error) {
    logger.warn("Withheld the hosted image tool after the image policy check", {
      errorType: error instanceof AssistantError ? error.type : "unknown",
    });

    return activatedToolNames.filter((name) => name !== "image_generation");
  }
}
