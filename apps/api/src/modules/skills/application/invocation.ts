import {
  getBuiltInSkillCatalogue,
  type SkillCatalog,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import {
  canModelInvokeSkill,
  skillIdSchema,
  type ChatRequestOptions,
  type SkillAvailability,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Message } from "~/types";

import type { PerMessageSkill } from "./per-message";

export function listModelInvocableSkills(
  skills: readonly SkillAvailability[] | undefined,
  invokedSkillId?: string,
): SkillAvailability[] {
  return (skills ?? []).filter(
    (skill) => skill.state === "ready" && canModelInvokeSkill(skill, invokedSkillId),
  );
}

export function resolveInvokedSkill(params: {
  invokedSkillId: string | undefined;
  skills: readonly SkillAvailability[];
  catalog: SkillCatalog | null | undefined;
  strict?: boolean;
}): PerMessageSkill | null {
  if (!params.invokedSkillId) {
    return null;
  }

  const skill = params.skills.find(
    (candidate) => candidate.id === params.invokedSkillId && candidate.state === "ready",
  );
  const body = skill?.userInvocable
    ? (params.catalog ?? getBuiltInSkillCatalogue()).loadRuntime(skill.id)?.content.body.trim()
    : undefined;

  if ((!skill || !body) && params.strict === false) {
    return null;
  }

  if (!skill || !body) {
    throw new AssistantError(
      `The ${params.invokedSkillId} skill cannot be used in this conversation.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { id: skill.id, name: skill.name, body };
}

export function withInvokedSkill(
  invoked: PerMessageSkill | null,
  skills: readonly PerMessageSkill[],
): PerMessageSkill[] {
  return invoked ? [invoked, ...skills.filter((skill) => skill.id !== invoked.id)] : [...skills];
}

function isTurnStartingUserMessage(message: Message): boolean {
  if (message.role !== "user") {
    return false;
  }

  if (!isRecord(message.data)) {
    return true;
  }

  return !isRecord(message.data.toolInteraction) && !Array.isArray(message.data.attachments);
}

export function readStoredInvokedSkillId(messages: readonly Message[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];

    if (!message || !isTurnStartingUserMessage(message)) {
      continue;
    }

    const invoked = isRecord(message.data) ? message.data.invokedSkill : undefined;
    const parsed = skillIdSchema.safeParse(isRecord(invoked) ? invoked.id : undefined);

    return parsed.success ? parsed.data : undefined;
  }

  return undefined;
}

export function withInvokedSkillOption(
  options: ChatRequestOptions | undefined,
  invokedSkillId: string | undefined,
): ChatRequestOptions | undefined {
  return invokedSkillId ? { ...options, skill: { id: invokedSkillId } } : options;
}
