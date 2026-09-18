import {
  buildMetaAssistantPrompt,
  buildSandboxControllerPrompt,
  buildStandardChatPrompt,
  getPromptText,
  getTextToImageSystemPrompt,
  renderPrompt,
  type PromptMemoryPolicy,
  type SandboxContextInput,
} from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  SKILL_LOAD_TOOL_NAME,
  resolveSandboxDeliveryPolicy,
  type SkillAvailability,
} from "@ngriffin_uk/polychat-schemas";
import { trimTemplateWhitespace } from "@ngriffin_uk/polychat-utility-server/strings";

import { APP_DESCRIPTION, APP_NAME } from "~/config/app";
import { getInboundChannelProfile } from "~/modules/chat/application/policy/channels";
import { resolveMemoryPolicy } from "~/modules/chat/application/policy/memory";
import { toAssistantModelMetadata } from "~/modules/chat/application/prompts/model-metadata";
import { getModelConfigByMatchingModel } from "~/modules/models/application/resolve";
import type { AssistantPersona, ChatRequestOptions, IBody, IUser, IUserSettings } from "~/types";

const logger = getLogger({ prefix: "services/chat/prompts" });

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

export type { PromptMemoryPolicy } from "@ngriffin_uk/polychat-ai-prompts";

function asToday(): string {
  return new Date().toISOString().split("T")[0];
}

function toSandboxDeliveryLabel(options: ChatRequestOptions["sandbox"]): string {
  const deliveryPolicy = resolveSandboxDeliveryPolicy(
    options?.deliveryPolicy,
    options?.shouldCommit,
  );

  if (deliveryPolicy.mode === "leave_uncommitted") {
    return getPromptText("chat/sandbox/context/delivery-leave-uncommitted");
  }

  if (deliveryPolicy.mode === "review_branch") {
    return getPromptText(
      deliveryPolicy.destination === "pull_request"
        ? "chat/sandbox/context/delivery-review-pr"
        : "chat/sandbox/context/delivery-review-branch",
    );
  }

  if (deliveryPolicy.mode === "commit_to_branch") {
    return renderPrompt("chat/sandbox/context/delivery-commit-branch", {
      targetBranch: deliveryPolicy.targetBranch,
    });
  }

  return renderPrompt("chat/sandbox/context/delivery-custom", {
    instructions: deliveryPolicy.instructions,
  });
}

function toSandboxContext(options: ChatRequestOptions["sandbox"]): SandboxContextInput {
  return {
    repository: options?.repo ?? undefined,
    installationId:
      typeof options?.installationId === "number" ? options.installationId : undefined,
    taskType: options?.taskType ?? undefined,
    promptStrategy: options?.promptStrategy ?? undefined,
    delivery: toSandboxDeliveryLabel(options),
    environmentSetup: options?.environmentSetup
      ? getPromptText(
          options.environmentSetup.source === "repository"
            ? "chat/sandbox/context/environment-repository"
            : "chat/sandbox/context/environment-project",
        )
      : getPromptText("chat/sandbox/context/environment-none"),
    timeoutSeconds:
      typeof options?.timeoutSeconds === "number" ? options.timeoutSeconds : undefined,
  };
}

export async function getSystemPrompt(options: SystemPromptOptions): Promise<string> {
  const { request, model, user, userSettings, skills, persona } = options;
  const modelConfig = await getModelConfigByMatchingModel(model, undefined, request.provider);
  const supportsToolCalls = modelConfig?.supportsToolCalls || false;
  const memoryPolicy = options.memory ?? resolveMemoryPolicy({ user, userSettings });
  const modelMetadata = toAssistantModelMetadata({
    modelId: model,
    modelConfig: modelConfig ?? undefined,
    request,
    fallbackModelId: request.model,
  });
  const preferredLanguage = request.lang?.trim() || null;

  if (request.meta_assistant) {
    return trimTemplateWhitespace(
      buildMetaAssistantPrompt({
        userReference: userSettings?.nickname?.trim() || user?.name?.trim() || null,
        uiContext: request.meta_assistant.ui_context,
      }),
    );
  }

  if (request.options?.sandbox?.enabled) {
    return trimTemplateWhitespace(
      buildSandboxControllerPrompt({
        assistantName: APP_NAME,
        assistantDescription: APP_DESCRIPTION,
        model: modelMetadata,
        sandbox: toSandboxContext(request.options.sandbox),
        userContext: {
          date: request.date || asToday(),
          userNickname: userSettings?.nickname || null,
          userJobRole: userSettings?.job_role || null,
          latitude: request.location?.latitude ?? null,
          longitude: request.location?.longitude ?? null,
          language: preferredLanguage,
        },
      }),
    );
  }

  const inputs = modelConfig?.modalities?.input ?? ["text"];
  const outputs = modelConfig?.modalities?.output ?? inputs;
  const supportsTextOutput =
    outputs.includes("text") || (!outputs.length && inputs.includes("text"));

  if (modelConfig && !supportsTextOutput) {
    return trimTemplateWhitespace(
      outputs.includes("image") ? getTextToImageSystemPrompt(request.image_style) : "",
    );
  }

  try {
    const verbosity = request.text?.verbosity ?? request.verbosity ?? "medium";
    const reasoningEffort = request.reasoning?.effort ?? request.reasoning_effort ?? "none";
    const simulatedThinking = reasoningEffort === "simulated-thinking";
    const channel = request.options?.channel;

    return trimTemplateWhitespace(
      buildStandardChatPrompt({
        assistantName: APP_NAME,
        assistantDescription: APP_DESCRIPTION,
        model: modelMetadata,
        mode: request.mode,
        platform: request.platform,
        verbosity,
        preferredLanguage,
        supportsToolCalls,
        simulatedThinking,
        isCoding: modelConfig?.promptTemplate === "coding",
        skills: (skills ?? [])
          .filter((skill) => skill.state === "ready")
          .map((skill) => ({ id: skill.id, description: skill.description })),
        memoryPolicy,
        persona,
        channel: channel
          ? {
              id: channel.id,
              label: getInboundChannelProfile(channel.id).label,
              from: channel.from,
              to: channel.to,
            }
          : null,
        userContext: {
          date: request.date || asToday(),
          userNickname: userSettings?.nickname || null,
          userJobRole: userSettings?.job_role || null,
          latitude: request.location?.latitude || user?.latitude,
          longitude: request.location?.longitude || user?.longitude,
        },
        skillLoadTool: SKILL_LOAD_TOOL_NAME,
        userTraits: userSettings?.traits || null,
        userPreferences: userSettings?.preferences || null,
      }),
    );
  } catch (error) {
    logger.error("Error generating standard prompt", { error });

    return "";
  }
}
