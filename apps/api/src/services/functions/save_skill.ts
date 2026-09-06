import { SKILL_SAVE_TOOL_NAME, type SaveSkillInput } from "@ngriffin_uk/polychat-schemas";

import { createPersonalSkill, publishProjectSkill } from "~/services/skills";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import { save_skill as saveSkillDescriptor } from "./definitions/save_skill";
import { resolveRequestProjectId } from "./request-context";

export function buildSkillDocument(input: SaveSkillInput): string {
  const description = input.description.trim().replace(/\s+/gu, " ");

  return `---\nname: ${input.name}\ndescription: ${JSON.stringify(description)}\n---\n\n${input.instructions.trim()}\n`;
}

export const save_skill: ApiToolDefinition = {
  ...saveSkillDescriptor,
  execute: async (args: SaveSkillInput, toolContext) => {
    const request = toolContext.request;
    const context = request.context;
    const user = request.user;

    if (!context || !user?.id) {
      throw new AssistantError(
        "Saving a skill needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = resolveRequestProjectId(request);
    const content = buildSkillDocument(args);
    const skill = projectId
      ? await publishProjectSkill(context, user.id, projectId, { content })
      : await createPersonalSkill(context, user.id, { content });
    const scope = projectId ? "this project" : "your library";

    return {
      status: "success",
      name: SKILL_SAVE_TOOL_NAME,
      content: `Saved ${skill.name} to ${scope}. Load it by name next time, or edit it in Teammates and tools.`,
      data: { name: skill.name, scope: projectId ? "project" : "personal", projectId },
    } satisfies IFunctionResponse;
  },
};
