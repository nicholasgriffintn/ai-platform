import type { IBody, IUserSettings } from "~/types";
import { PromptBuilder } from "./builder";
import { resolvePromptLayout } from "./layout";
import {
  buildAssistantMetadataSection,
  type PromptModelMetadata,
} from "./sections/metadata";
import { buildAssistantPrinciplesSection } from "./sections/principles";
import { buildCodingExampleOutputSection } from "./sections/examples";
import { buildUserContextSection } from "./sections/user-context";
import { getResponseStyle, resolvePromptCapabilities } from "./utils";

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

  const capabilities = resolvePromptCapabilities({
    supportsToolCalls,
    supportsArtifacts,
    supportsReasoning,
    requiresThinkingPrompt,
    modelMetadata,
  });

  const layout = resolvePromptLayout({
    contextWindow: modelMetadata?.modelConfig?.contextWindow,
    isAgent,
    isCoding: true,
    capabilities,
  });

  const {
    traits,
    preferences,
    problemBreakdownInstructions,
    answerFormatInstructions,
  } = getResponseStyle(
    response_mode,
    capabilities.supportsReasoning,
    capabilities.requiresThinkingPrompt,
    capabilities.supportsToolCalls,
    capabilities.supportsArtifacts,
    isAgent,
    memoriesEnabled,
    userTraits,
    userPreferences,
    true,
    layout.instructionVariant,
  );

  const metadataSection = buildAssistantMetadataSection({
    request: preferredLanguage
      ? { ...request, lang: preferredLanguage }
      : request,
    modelId: modelMetadata?.modelId,
    modelConfig: modelMetadata?.modelConfig,
    format: layout.metadataFormat,
  });

  const principlesSection = buildAssistantPrinciplesSection({
    isAgent,
    supportsToolCalls: capabilities.supportsToolCalls,
    supportsArtifacts: capabilities.supportsArtifacts,
    supportsReasoning: capabilities.supportsReasoning,
    preferredLanguage,
    responseMode: response_mode,
    format: layout.principlesFormat,
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
        supportsReasoning: capabilities.supportsReasoning,
        supportsArtifacts: capabilities.supportsArtifacts,
        problemBreakdownInstructions,
        answerFormatInstructions,
        preferredLanguage,
        responseMode: response_mode,
        variant: layout.exampleVariant === "full" ? "full" : "compact",
        artifactVariant: layout.artifactExampleVariant,
      }),
    )
    .startSection()
    .addLine(
      "Remember to tailor your response to the specified programming language when applicable, and always strive for accuracy and professionalism in your explanations and code examples.",
    );

  return builder.build();
}
