import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { Teammate } from "~/lib/database/schema";
import { request_approval, ask_user } from "~/services/functions/human_in_the_loop";
import { messageParent } from "~/services/functions/message-parent";
import { readTeammateSkillIds } from "~/services/teammates/teammateResponse";
import type { AssistantPersona, AssistantPersonaExample } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

const logger = getLogger({ prefix: "services/teammates/completion-tools" });

const CORE_TEAMMATE_TOOLS: ApiToolDefinition[] = [request_approval, ask_user, messageParent];

type CompletionTeammate = Pick<Teammate, "system_prompt" | "few_shot_examples" | "skill_ids">;

export type TeammateCompletionToolDefinition =
  | ApiToolDefinition
  | {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };

export function buildTeammateCompletionTools(): TeammateCompletionToolDefinition[] {
  return CORE_TEAMMATE_TOOLS;
}

export function buildTeammatePersona(
  teammate: CompletionTeammate,
  behaviour: "colleague" | "bot" = "colleague",
): AssistantPersona {
  return {
    instructions: buildPersonaInstructions(teammate, behaviour),
    examples: parseFewShotExamples(teammate.few_shot_examples),
  };
}

function buildPersonaInstructions(
  teammate: CompletionTeammate,
  behaviour: "colleague" | "bot",
): string | undefined {
  const skillIds = readTeammateSkillIds(teammate.skill_ids);
  const instructions = renderPrompt("apps/teammates/persona-instructions", {
    systemPrompt: teammate.system_prompt?.trim() || undefined,
    skillIds: skillIds.length > 0 ? skillIds.join(", ") : undefined,
    isBot: behaviour === "bot" ? "true" : undefined,
  }).trim();

  return instructions || undefined;
}

function parseFewShotExamples(rawExamples: unknown): AssistantPersonaExample[] {
  if (!rawExamples) {
    return [];
  }

  try {
    const parsed = typeof rawExamples === "string" ? safeParseJson(rawExamples) : rawExamples;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (example): example is AssistantPersonaExample =>
        typeof example === "object" &&
        example !== null &&
        typeof (example as { input?: unknown }).input === "string" &&
        typeof (example as { output?: unknown }).output === "string",
    );
  } catch (error) {
    logger.error("Error parsing few-shot examples", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return [];
  }
}
