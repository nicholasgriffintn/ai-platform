import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import type { IBody, IUserSettings } from "~/types";

import { PromptBuilder } from "./builder";
import { resolvePromptLayout } from "./layout";
import { buildCodingConductSection } from "./sections/coding-conduct";
import { buildFormattingSection } from "./sections/formatting";
import { buildAssistantMetadataSection, type PromptModelMetadata } from "./sections/metadata";
import { buildAssistantPrinciplesSection } from "./sections/principles";
import { buildResponseStyleSection } from "./sections/response-style";
import { buildSafetyStandardsSection } from "./sections/safety";
import {
  DISABLED_PROMPT_MEMORY_POLICY,
  buildSessionConfigSection,
  type PromptMemoryPolicy,
} from "./sections/session-config";
import { buildSkillsSection } from "./sections/skills";
import { buildUserContextSection } from "./sections/user-context";
import { getResponseStyle, resolvePromptCapabilities } from "./utils";

export function returnCodingPrompt(
  request: IBody,
  userSettings?: IUserSettings,
  supportsToolCalls?: boolean,
  modelMetadata?: PromptModelMetadata,
  skills?: readonly SkillAvailability[],
  memoryPolicy: PromptMemoryPolicy = DISABLED_PROMPT_MEMORY_POLICY,
): string {
  const chatMode = request.mode || "standard";

  const userNickname = userSettings?.nickname || null;
  const userJobRole = userSettings?.job_role || null;
  const userTraits = userSettings?.traits || null;
  const userPreferences = userSettings?.preferences || null;
  const verbosity = request.text?.verbosity ?? request.verbosity ?? "medium";
  const reasoningEffort = request.reasoning?.effort ?? request.reasoning_effort ?? "none";
  const simulatedThinking = reasoningEffort === "simulated-thinking";
  const preferredLanguage = request.lang?.trim() || null;

  const isAgent =
    chatMode === "agent" || chatMode === "plan" || chatMode === "build" || chatMode === "explore";

  const latitude = request.location?.latitude ?? null;
  const longitude = request.location?.longitude ?? null;
  const date = request.date || new Date().toISOString().split("T")[0];

  const capabilities = resolvePromptCapabilities({
    supportsToolCalls,
    simulatedThinking,
    modelMetadata,
  });

  const layout = resolvePromptLayout({
    contextWindow: modelMetadata?.modelConfig?.contextWindow,
  });

  const metadataSection = buildAssistantMetadataSection({
    request: preferredLanguage ? { ...request, lang: preferredLanguage } : request,
    modelId: modelMetadata?.modelId,
    modelConfig: modelMetadata?.modelConfig,
    format: layout.metadataFormat,
  });

  const principlesSection = buildAssistantPrinciplesSection({
    isAgent,
    supportsToolCalls: capabilities.supportsToolCalls,
    simulatedThinking: capabilities.simulatedThinking,
    preferredLanguage,
    format: layout.principlesFormat,
  });
  const responseStyle = getResponseStyle(
    verbosity,
    userTraits,
    userPreferences,
    true,
    isAgent,
    capabilities.simulatedThinking,
    layout.principlesFormat,
  );

  const builder = new PromptBuilder(metadataSection)
    .addLine(
      "<instruction_precedence>\n<order>safety_standards > behaviour > coding_conduct > response_style > formatting > available_skills > session_config</order>\n<conflict_rule>Resolve conflicts silently in this order. Surface only limitations that materially change what the user receives.</conflict_rule>\n</instruction_precedence>",
    )
    .addLine()
    .add(principlesSection)
    .add(buildResponseStyleSection(responseStyle))
    .add(
      buildFormattingSection({
        isCoding: true,
        format: layout.principlesFormat,
      }),
    )
    .add(buildCodingConductSection())
    .add(buildSafetyStandardsSection())
    .add(buildSkillsSection(skills))
    .add(
      buildUserContextSection({
        date,
        userNickname,
        userJobRole,
        latitude,
        longitude,
      }),
    )
    .add(
      buildSessionConfigSection({
        mode: chatMode,
        platform: request.platform,
        verbosity,
        preferredLanguage,
        memory: memoryPolicy,
      }),
    );

  return builder.build();
}
