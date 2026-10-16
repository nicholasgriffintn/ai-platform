import {
  buildSkillDocument,
  MAX_PER_MESSAGE_SKILL_BODY_BYTES,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import { SKILL_SAVE_TOOL_NAME, type SaveSkillInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createPersonalSkill, publishProjectSkill } from "~/modules/skills/application";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { save_skill as saveSkillDescriptor } from "./definitions/save_skill";

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

    if (
      args.applyAutomatically &&
      new TextEncoder().encode(args.instructions.trim()).byteLength >
        MAX_PER_MESSAGE_SKILL_BODY_BYTES
    ) {
      throw new AssistantError(
        "Skills applied automatically must keep their instructions to 2 KB or less",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const projectId = resolveRequestProjectId(request);
    const content = buildSkillDocument({
      name: args.name,
      description: args.description,
      instructions: args.instructions,
      ...(args.applyAutomatically ? { activation: "per-message" as const } : {}),
    });
    const skill = projectId
      ? await publishProjectSkill(context, user.id, projectId, { content })
      : await createPersonalSkill(context, user.id, { content });
    const scope = projectId ? "this project" : "your library";

    return {
      status: "success",
      name: SKILL_SAVE_TOOL_NAME,
      content: args.applyAutomatically
        ? `Saved ${skill.name} to ${scope}. It will be applied to messages it clearly helps with; edit it in Teammates and tools.`
        : `Saved ${skill.name} to ${scope}. Load it by name next time, or edit it in Teammates and tools.`,
      data: { name: skill.name, scope: projectId ? "project" : "personal", projectId },
    } satisfies IFunctionResponse;
  },
};
