import {
  SKILL_REVISE_TOOL_NAME,
  type ProposeSkillRevisionInput,
} from "@ngriffin_uk/polychat-schemas";

import { getPersonalSkill, getPersonalSkillState, savePersonalSkillDraft } from "~/services/skills";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import { propose_skill_revision as proposeSkillRevisionDescriptor } from "./definitions/propose_skill_revision";
import { buildSkillDocument } from "./save_skill";

export const propose_skill_revision: ApiToolDefinition = {
  ...proposeSkillRevisionDescriptor,
  execute: async (args: ProposeSkillRevisionInput, toolContext) => {
    const request = toolContext.request;
    const context = request.context;
    const userId = request.user?.id;

    if (!context || !userId) {
      throw new AssistantError(
        "Proposing a skill revision needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const existing = await getPersonalSkill(context, userId, args.name);
    const state = await getPersonalSkillState(context, userId, args.name);
    const content = buildSkillDocument({
      name: args.name,
      description: existing.description,
      instructions: args.instructions,
    });

    const saved = await savePersonalSkillDraft(context, userId, args.name, {
      content,
      changeNote: args.changeNote,
      expectedStateVersion: state.stateVersion,
    });

    return {
      status: "success",
      name: SKILL_REVISE_TOOL_NAME,
      content: `Proposed a change to ${args.name}: ${args.changeNote}. It is a draft until you accept it, so nothing behaves differently yet.`,
      data: {
        name: args.name,
        draftRevisionId: saved.state.draftRevisionId,
        changeNote: args.changeNote,
      },
    } satisfies IFunctionResponse;
  },
};
