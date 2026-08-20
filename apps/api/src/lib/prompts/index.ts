import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { resolveMemoryPolicy } from "~/lib/chat/memoryPolicy";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { AssistantPersona, IBody, IUser, IUserSettings } from "~/types";
import { trimTemplateWhitespace } from "~/utils/strings";

import { getTextToImageSystemPrompt } from "./image";
import { returnSandboxPrompt } from "./sandbox";
import type { PromptMemoryPolicy } from "./sections/session-config";
import { returnStandardPrompt } from "./standard";
import { emptyPrompt } from "./utils";

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
