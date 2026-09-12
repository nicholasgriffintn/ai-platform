import type { Teammate } from "~/lib/database/schema";
import { request_approval, ask_user } from "~/services/functions/human_in_the_loop";
import { messageParent } from "~/services/functions/message-parent";
import { readTeammateSkillIds } from "~/services/teammates/teammateResponse";
import type { AssistantPersona, AssistantPersonaExample } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

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
  const sections = [
    teammate.system_prompt?.trim() || undefined,
    skillIds.length > 0
      ? `Load these skills before you start and follow them: ${skillIds.join(", ")}.`
      : undefined,
    behaviour === "colleague"
      ? "Work directly alongside the user in this persistent context. Preserve continuity and make decisions collaboratively."
      : "Complete this automated assignment independently within the exact granted scope. Pause for questions, approvals or supervised computer control when authority is missing.",
  ].filter((section): section is string => Boolean(section));

  return sections.length > 0 ? sections.join("\n\n") : undefined;
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
