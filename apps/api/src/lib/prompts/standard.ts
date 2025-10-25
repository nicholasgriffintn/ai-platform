import type { IBody, IUser, IUserSettings } from "~/types";
import { getLogger } from "~/utils/logger";
import { PromptBuilder } from "./builder";
import { buildAgentGuidelinesSection } from "./sections/agent-guidelines";
import {
  buildAssistantMetadataSection,
  type PromptModelMetadata,
} from "./sections/metadata";
import { buildAssistantPrinciplesSection } from "./sections/principles";
import { buildStandardExampleOutputSection } from "./sections/examples";
import { buildUserContextSection } from "./sections/user-context";
import { getResponseStyle } from "./utils";

const logger = getLogger({ prefix: "lib/prompts/standard" });

export async function returnStandardPrompt(
  request: IBody,
  user?: IUser,
  userSettings?: IUserSettings,
  supportsToolCalls?: boolean,
  supportsArtifacts?: boolean,
  supportsReasoning?: boolean,
  requiresThinkingPrompt?: boolean,
  modelMetadata?: PromptModelMetadata,
): Promise<string> {
  try {
    const chatMode = request.mode || "standard";

    const userNickname = userSettings?.nickname || null;
    const userJobRole = userSettings?.job_role || null;
    const userTraits = userSettings?.traits || null;
    const userPreferences = userSettings?.preferences || null;
    const memoriesEnabled =
      userSettings?.memories_save_enabled ||
      userSettings?.memories_chat_history_enabled;

    const latitude = request.location?.latitude || user?.latitude;
    const longitude = request.location?.longitude || user?.longitude;
    const date = request.date || new Date().toISOString().split("T")[0];
    const response_mode = request.response_mode || "normal";
    const preferredLanguage = request.lang?.trim() || null;

    const isAgent = chatMode === "agent";

    const effectiveSupportsToolCalls =
      supportsToolCalls ??
      modelMetadata?.modelConfig?.supportsToolCalls ??
      false;
    const effectiveSupportsArtifacts =
      supportsArtifacts ??
      modelMetadata?.modelConfig?.supportsArtifacts ??
      false;
    const effectiveSupportsReasoning =
      supportsReasoning ??
      modelMetadata?.modelConfig?.supportsReasoning ??
      false;
    const effectiveRequiresThinkingPrompt =
      requiresThinkingPrompt ??
      modelMetadata?.modelConfig?.requiresThinkingPrompt ??
      false;

    const {
      traits,
      preferences,
      problemBreakdownInstructions,
      answerFormatInstructions,
    } = getResponseStyle(
      response_mode,
      effectiveSupportsReasoning,
      effectiveRequiresThinkingPrompt,
      effectiveSupportsToolCalls,
      effectiveSupportsArtifacts,
      isAgent,
      memoriesEnabled,
      userTraits,
      userPreferences,
      false,
    );

    const metadataSection = buildAssistantMetadataSection({
      request: preferredLanguage
        ? { ...request, lang: preferredLanguage }
        : request,
      modelId: modelMetadata?.modelId,
      modelConfig: modelMetadata?.modelConfig,
    });

    const principlesSection = buildAssistantPrinciplesSection({
      isAgent,
      supportsToolCalls: effectiveSupportsToolCalls,
      supportsArtifacts: effectiveSupportsArtifacts,
      supportsReasoning: effectiveSupportsReasoning,
      responseMode: response_mode,
      preferredLanguage,
    });

    const userContextSection = buildUserContextSection({
      date,
      userNickname,
      userJobRole,
      latitude,
      longitude,
      language: preferredLanguage,
    });

    const builder = new PromptBuilder(metadataSection)
      .addLine(
        isAgent
          ? "<assistant_info>You are a helpful agent with access to a range of powerful tools that extend your capabilities.</assistant_info>"
          : "<assistant_info>You are an AI assistant helping with daily tasks.</assistant_info>",
      )
      .addLine()
      .add(principlesSection)
      .addLine(`<response_traits>${traits}</response_traits>`)
      .addLine(`<response_preferences>${preferences}</response_preferences>`)
      .addLine()
      .add(userContextSection);

    if (!isAgent) {
      builder.add(
        buildStandardExampleOutputSection({
          supportsReasoning: effectiveSupportsReasoning,
          supportsArtifacts: effectiveSupportsArtifacts,
          problemBreakdownInstructions,
          answerFormatInstructions,
        }),
      );
    }

    if (isAgent) {
      builder.add(buildAgentGuidelinesSection());
    }

    return builder.build();
  } catch (error) {
    logger.error("Error generating standard prompt", { error });
    return "";
  }
}
