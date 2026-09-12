import { SKILL_SAVE_TOOL_NAME, type SaveSkillInput } from "@ngriffin_uk/polychat-schemas";

import { createPersonalSkill, publishProjectSkill } from "~/services/skills";
import { buildSkillDocument } from "~/services/skills/document";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import { save_skill as saveSkillDescriptor } from "./definitions/save_skill";
import { resolveRequestProjectId } from "./request-context";

export { buildSkillDocument };

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
    const content = buildSkillDocument({
      name: args.name,
      description: args.description,
      instructions: args.instructions,
    });
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
