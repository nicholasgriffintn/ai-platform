import type { IBody, IUser, IUserSettings } from "~/types";
import { getLogger } from "~/utils/logger";

import { PromptBuilder } from "./builder";
import { resolvePromptLayout } from "./layout";
import { buildAgentGuidelinesSection } from "./sections/agent-guidelines";
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
import { buildSkillsSection, type PromptSkillContext } from "./sections/skills";
import { buildUserContextSection } from "./sections/user-context";
import { getResponseStyle, resolvePromptCapabilities } from "./utils";

const logger = getLogger({ prefix: "lib/prompts/standard" });

export async function returnStandardPrompt(
  request: IBody,
  user?: IUser,
  userSettings?: IUserSettings,
  supportsToolCalls?: boolean,
  modelMetadata?: PromptModelMetadata,
  skills?: PromptSkillContext,
  memoryPolicy: PromptMemoryPolicy = DISABLED_PROMPT_MEMORY_POLICY,
): Promise<string> {
  try {
    const chatMode = request.mode || "standard";

    const userNickname = userSettings?.nickname || null;
    const userJobRole = userSettings?.job_role || null;
    const userTraits = userSettings?.traits || null;
    const userPreferences = userSettings?.preferences || null;
    const latitude = request.location?.latitude || user?.latitude;
    const longitude = request.location?.longitude || user?.longitude;
    const date = request.date || new Date().toISOString().split("T")[0];
    const verbosity = request.text?.verbosity ?? request.verbosity ?? "medium";
    const reasoningEffort = request.reasoning?.effort ?? request.reasoning_effort ?? "none";
    const simulatedThinking = reasoningEffort === "simulated-thinking";
    const preferredLanguage = request.lang?.trim() || null;

    const isAgent =
      chatMode === "agent" || chatMode === "plan" || chatMode === "build" || chatMode === "explore";

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
      false,
      isAgent,
      capabilities.simulatedThinking,
      layout.principlesFormat,
    );

    const userContextSection = buildUserContextSection({
      date,
      userNickname,
      userJobRole,
      latitude,
      longitude,
    });

    const builder = new PromptBuilder(metadataSection)
      .addLine(
        "<instruction_precedence>\n<order>safety_standards > behaviour > response_style > formatting > available_skills > session_config</order>\n<conflict_rule>Resolve conflicts silently in this order. Surface only limitations that materially change what the user receives.</conflict_rule>\n</instruction_precedence>",
      )
      .addLine()
      .add(principlesSection)
      .add(buildResponseStyleSection(responseStyle))
      .add(
        buildFormattingSection({
          format: layout.principlesFormat,
        }),
      )
      .add(buildSafetyStandardsSection());

    if (isAgent) {
      builder.add(buildAgentGuidelinesSection());
    }

    builder
      .add(buildSkillsSection(skills))
      .add(userContextSection)
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
  } catch (error) {
    logger.error("Error generating standard prompt", { error });

    return "";
  }
}
