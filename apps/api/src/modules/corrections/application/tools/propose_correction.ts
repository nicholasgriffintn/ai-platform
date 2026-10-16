import { buildSkillDocument } from "@ngriffin_uk/polychat-library-skills-catalogue";
import {
  PROPOSE_CORRECTION_TOOL_NAME,
  type ProposeCorrectionInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { proposeCorrection } from "~/modules/corrections/application/propose";
import { store_memory } from "~/modules/memory/application/tools/memory";
import {
  getPersonalSkill,
  getPersonalSkillState,
  savePersonalSkillDraft,
} from "~/modules/skills/application";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import { propose_correction as proposeCorrectionDescriptor } from "./definitions/propose_correction";

async function placeInSkill(
  context: ServiceContext,
  userId: number,
  pattern: string,
  placement: Extract<ProposeCorrectionInput["placement"], { type: "skill" }>,
) {
  const existing = await getPersonalSkill(context, userId, placement.name);
  const state = await getPersonalSkillState(context, userId, placement.name);
  const saved = await savePersonalSkillDraft(context, userId, placement.name, {
    content: buildSkillDocument({
      name: placement.name,
      description: existing.description,
      instructions: placement.instructions,
    }),
    changeNote: pattern,
    expectedStateVersion: state.stateVersion,
  });

  return {
    placementRef: placement.name,
    note: `Proposed a change to ${placement.name} (draft ${saved.state.draftRevisionId}). Nothing behaves differently until they accept it.`,
  };
}

async function placeInMemory(pattern: string, toolContext: ApiToolExecutionContext) {
  const stored = await store_memory.execute({ text: pattern, category: "correction" }, toolContext);

  if (stored.status === "error") {
    return { failure: stored };
  }

  const scope = toolContext.request.memoryScope;

  return {
    placementRef:
      scope?.type === "bound" ? (scope.teammateContext?.memoryDocumentId ?? null) : null,
    note: typeof stored.content === "string" ? stored.content : "Saved to memory.",
  };
}

export const propose_correction: ApiToolDefinition = {
  ...proposeCorrectionDescriptor,
  execute: async (args: ProposeCorrectionInput, toolContext) => {
    const request = toolContext.request;
    const context = request.context;
    const userId = request.user?.id;
    const conversationId = request.request?.completion_id || toolContext.completionId;

    if (!context || !userId || !conversationId) {
      throw new AssistantError(
        "Recording a correction needs a signed-in user in a conversation",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const placement = args.placement;
    const scope = request.memoryScope;
    const outcome = await proposeCorrection<IFunctionResponse>(context, {
      conversationId,
      teammateContextId: scope?.type === "bound" ? (scope.teammateContext?.id ?? null) : null,
      pattern: args.pattern,
      quote: args.quote,
      placement: placement.type,
      place: () =>
        placement.type === "skill"
          ? placeInSkill(context, userId, args.pattern, placement)
          : placeInMemory(args.pattern, toolContext),
    });

    if (outcome.kind === "placement_failed") {
      return outcome.failure;
    }

    if (outcome.kind === "already_recorded") {
      const { correction } = outcome;

      return {
        status: "success",
        name: PROPOSE_CORRECTION_TOOL_NAME,
        content: `This rule was already recorded ("${correction.pattern}", in ${correction.placement}) and has now come up ${correction.recurrences + 2} times, so where it lives is not holding. Nothing new was saved. Offer to put it in a skill: propose_correction with a skill placement for an existing skill, or save_skill for a new one.`,
        data: { correctionId: correction.id, recurred: true, placement: correction.placement },
      } satisfies IFunctionResponse;
    }

    return {
      status: "success",
      name: PROPOSE_CORRECTION_TOOL_NAME,
      content: outcome.recurred
        ? `This rule had come up before, so it moves to ${outcome.placement}. ${outcome.placed.note}`
        : `Recorded the rule "${args.pattern}". ${outcome.placed.note}`,
      data: {
        correctionId: outcome.correctionId,
        recurred: outcome.recurred,
        placement: outcome.placement,
        placementRef: outcome.placed.placementRef,
      },
    } satisfies IFunctionResponse;
  },
};
