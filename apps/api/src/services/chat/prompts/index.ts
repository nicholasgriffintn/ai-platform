import { getTextToImageSystemPrompt } from "@ngriffin_uk/polychat-ai-providers";
import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";
import { trimTemplateWhitespace } from "@ngriffin_uk/polychat-utility-server/strings";

import { resolveMemoryPolicy } from "~/services/chat/policy/memory";
import { returnMetaAssistantPrompt } from "~/services/chat/prompts/meta-assistant";
import { returnSandboxPrompt } from "~/services/chat/prompts/sandbox";
import type { PromptMemoryPolicy } from "~/services/chat/prompts/sections/session-config";
import { returnStandardPrompt } from "~/services/chat/prompts/standard";
import { emptyPrompt } from "~/services/chat/prompts/utils";
import { getModelConfigByMatchingModel } from "~/services/models/resolve";
import type { AssistantPersona, IBody, IUser, IUserSettings } from "~/types";

export type PromptRequest = IBody;

export interface SystemPromptOptions {
  request: PromptRequest;
  model: string;
  user?: IUser;
  userSettings?: IUserSettings;
  skills?: readonly SkillAvailability[];
  memory?: PromptMemoryPolicy;
  persona?: AssistantPersona | null;
}

export async function getSystemPrompt(options: SystemPromptOptions): Promise<string> {
  const { request, model, user, userSettings, skills, persona } = options;
  const modelConfig = await getModelConfigByMatchingModel(model, undefined, request.provider);
  const supportsToolCalls = modelConfig?.supportsToolCalls || false;
  const memoryPolicy = options.memory ?? resolveMemoryPolicy({ user, userSettings });
  const modelMetadata = modelConfig ? { modelId: model, modelConfig } : { modelId: model };

  if (request.meta_assistant) {
    return trimTemplateWhitespace(
      returnMetaAssistantPrompt({
        uiContext: request.meta_assistant.ui_context,
        user,
        userSettings,
      }),
    );
  }

  if (request.options?.sandbox?.enabled) {
    return trimTemplateWhitespace(returnSandboxPrompt(request, userSettings, modelMetadata));
  }

  const inputs = modelConfig?.modalities?.input ?? ["text"];
  const outputs = modelConfig?.modalities?.output ?? inputs;
  const supportsTextOutput =
    outputs.includes("text") || (!outputs.length && inputs.includes("text"));

  if (modelConfig && !supportsTextOutput) {
    return trimTemplateWhitespace(
      outputs.includes("image") ? getTextToImageSystemPrompt(request.image_style) : emptyPrompt(),
    );
  }

  return trimTemplateWhitespace(
    returnStandardPrompt({
      request,
      user,
      userSettings,
      supportsToolCalls,
      modelMetadata,
      skills,
      memoryPolicy,
      persona,
      isCoding: modelConfig?.promptTemplate === "coding",
    }),
  );
}
