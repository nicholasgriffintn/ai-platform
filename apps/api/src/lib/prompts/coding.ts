import type { IBody, IUserSettings } from "~/types";
import { PromptBuilder } from "./builder";
import {
  buildAssistantMetadataSection,
  type PromptModelMetadata,
} from "./sections/metadata";
import { buildAssistantPrinciplesSection } from "./sections/principles";
import { buildCodingExampleOutputSection } from "./sections/examples";
import { buildUserContextSection } from "./sections/user-context";
import { getResponseStyle } from "./utils";

export function returnCodingPrompt(
  request: IBody,
  userSettings?: IUserSettings,
  supportsToolCalls?: boolean,
  supportsArtifacts?: boolean,
  supportsReasoning?: boolean,
  requiresThinkingPrompt?: boolean,
  modelMetadata?: PromptModelMetadata,
): string {
  const chatMode = request.mode || "standard";

  const userNickname = userSettings?.nickname || null;
  const userJobRole = userSettings?.job_role || null;
  const userTraits = userSettings?.traits || null;
  const userPreferences = userSettings?.preferences || null;
  const memoriesEnabled =
    userSettings?.memories_save_enabled ||
    userSettings?.memories_chat_history_enabled;

  const response_mode = request.response_mode || "normal";
  const preferredLanguage = request.lang?.trim() || null;

  const isAgent = chatMode === "agent";

  const latitude = request.location?.latitude ?? null;
  const longitude = request.location?.longitude ?? null;
  const date = request.date || new Date().toISOString().split("T")[0];

  const effectiveSupportsToolCalls =
    supportsToolCalls ?? modelMetadata?.modelConfig?.supportsToolCalls ?? false;
  const effectiveSupportsArtifacts =
    supportsArtifacts ?? modelMetadata?.modelConfig?.supportsArtifacts ?? false;
  const effectiveSupportsReasoning =
    supportsReasoning ?? modelMetadata?.modelConfig?.supportsReasoning ?? false;
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
    true,
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
    preferredLanguage,
    responseMode: response_mode,
  });

  const builder = new PromptBuilder(metadataSection)
    .addLine(
      "<assistant_info>You are an experienced software developer tasked with answering coding questions or generating code based on user requests. Your responses should be professional, accurate, and tailored to the specified programming language when applicable.</assistant_info>",
    )
    .addLine()
    .add(principlesSection)
    .addLine(`<response_traits>${traits}</response_traits>`)
    .addLine(`<response_preferences>${preferences}</response_preferences>`)
    .addLine()
    .add(
      buildUserContextSection({
        date,
        userNickname,
        userJobRole,
        latitude,
        longitude,
        language: preferredLanguage,
      }),
    )
    .startSection();

  builder
    .add(
      buildCodingExampleOutputSection({
        supportsReasoning: effectiveSupportsReasoning,
        supportsArtifacts: effectiveSupportsArtifacts,
        problemBreakdownInstructions,
        answerFormatInstructions,
        preferredLanguage,
        responseMode: response_mode,
      }),
    )
    .startSection()
    .addLine(
      "Remember to tailor your response to the specified programming language when applicable, and always strive for accuracy and professionalism in your explanations and code examples.",
    );

  return builder.build();
}
