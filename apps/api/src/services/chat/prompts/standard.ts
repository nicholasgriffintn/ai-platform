import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { PromptBuilder } from "~/services/chat/prompts/builder";
import { buildAgentGuidelinesSection } from "~/services/chat/prompts/sections/agent-guidelines";
import { buildChannelSection } from "~/services/chat/prompts/sections/channel";
import { buildCodingConductSection } from "~/services/chat/prompts/sections/coding-conduct";
import { buildFormattingSection } from "~/services/chat/prompts/sections/formatting";
import {
  buildAssistantMetadataSection,
  type PromptModelMetadata,
} from "~/services/chat/prompts/sections/metadata";
import { buildPersonaSection } from "~/services/chat/prompts/sections/persona";
import { buildAssistantPrinciplesSection } from "~/services/chat/prompts/sections/principles";
import { buildResponseStyleSection } from "~/services/chat/prompts/sections/response-style";
import { buildSafetyStandardsSection } from "~/services/chat/prompts/sections/safety";
import {
  DISABLED_PROMPT_MEMORY_POLICY,
  buildSessionConfigSection,
  type PromptMemoryPolicy,
} from "~/services/chat/prompts/sections/session-config";
import { buildSkillsSection } from "~/services/chat/prompts/sections/skills";
import { buildUserContextSection } from "~/services/chat/prompts/sections/user-context";
import { getResponseStyle, resolvePromptCapabilities } from "~/services/chat/prompts/utils";
import type { AssistantPersona, IBody, IUser, IUserSettings } from "~/types";

const logger = getLogger({ prefix: "services/chat/prompts/standard" });

const AGENT_MODES = new Set(["agent", "plan", "build", "explore"]);

export interface StandardPromptOptions {
  request: IBody;
  user?: IUser;
  userSettings?: IUserSettings;
  supportsToolCalls?: boolean;
  modelMetadata?: PromptModelMetadata;
  skills?: readonly SkillAvailability[];
  memoryPolicy?: PromptMemoryPolicy;
  persona?: AssistantPersona | null;
  isCoding?: boolean;
}

function buildInstructionPrecedence(isCoding: boolean): string {
  const order = isCoding
    ? "safety_standards > channel_context > behaviour > coding_conduct > persona > response_style > formatting > available_skills > session_config"
    : "safety_standards > channel_context > behaviour > persona > response_style > formatting > available_skills > session_config";

  return `<instruction_precedence>\n<order>${order}</order>\n<conflict_rule>Resolve conflicts silently in this order. Surface only limitations that materially change what the user receives.</conflict_rule>\n</instruction_precedence>`;
}

export function returnStandardPrompt({
  request,
  user,
  userSettings,
  supportsToolCalls,
  modelMetadata,
  skills,
  memoryPolicy = DISABLED_PROMPT_MEMORY_POLICY,
  persona,
  isCoding = false,
}: StandardPromptOptions): string {
  try {
    const chatMode = request.mode || "standard";
    const userTraits = userSettings?.traits || null;
    const userPreferences = userSettings?.preferences || null;
    const verbosity = request.text?.verbosity ?? request.verbosity ?? "medium";
    const reasoningEffort = request.reasoning?.effort ?? request.reasoning_effort ?? "none";
    const simulatedThinking = reasoningEffort === "simulated-thinking";
    const preferredLanguage = request.lang?.trim() || null;
    const isTeammate = AGENT_MODES.has(chatMode);

    const capabilities = resolvePromptCapabilities({
      supportsToolCalls,
      simulatedThinking,
      modelMetadata,
    });
    const builder = new PromptBuilder(
      buildAssistantMetadataSection({
        request: preferredLanguage ? { ...request, lang: preferredLanguage } : request,
        modelId: modelMetadata?.modelId,
        modelConfig: modelMetadata?.modelConfig,
      }),
    )
      .addLine(buildInstructionPrecedence(isCoding))
      .addLine()
      .add(
        buildAssistantPrinciplesSection({
          isTeammate,
          supportsToolCalls: capabilities.supportsToolCalls,
          simulatedThinking: capabilities.simulatedThinking,
          preferredLanguage,
        }),
      )
      .add(buildPersonaSection(persona))
      .add(
        buildResponseStyleSection(
          getResponseStyle(
            verbosity,
            userTraits,
            userPreferences,
            isCoding,
            isTeammate,
            capabilities.simulatedThinking,
          ),
        ),
      )
      .add(buildFormattingSection({ isCoding }))
      .addIf(isCoding, buildCodingConductSection())
      .add(buildSafetyStandardsSection())
      .addIf(isTeammate, buildAgentGuidelinesSection())
      .add(buildChannelSection(request.options?.channel))
      .add(buildSkillsSection(skills))
      .add(
        buildUserContextSection({
          date: request.date || new Date().toISOString().split("T")[0],
          userNickname: userSettings?.nickname || null,
          userJobRole: userSettings?.job_role || null,
          latitude: request.location?.latitude || user?.latitude,
          longitude: request.location?.longitude || user?.longitude,
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
  } catch (error) {
    logger.error("Error generating standard prompt", { error });

    return "";
  }
}
