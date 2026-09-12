import type {
  AuthoredSkillVersionedDocument,
  TeachingSkillDraftInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getTeammateComputerTeachingRecording } from "~/services/teammates/computers";
import { AssistantError, ErrorType } from "~/utils/errors";
import { redactSensitiveTokens } from "~/utils/redaction";

import { getSkillDefinition } from "./catalog";
import { buildSkillDocument } from "./document";
import { personalSkillScope } from "./management-policy";
import { createStoredSkill, getStoredSkillVersion } from "./persistence";

type RecordedAction = "pointer" | "keyboard";
type RecordedActionGroup = { action: RecordedAction; count: number };

function groupRecordedActions(actions: readonly RecordedAction[]): RecordedActionGroup[] {
  const groups: Array<{ action: "pointer" | "keyboard"; count: number }> = [];

  for (const action of actions) {
    const previous = groups.at(-1);

    if (previous?.action === action) {
      previous.count += 1;
    } else {
      groups.push({ action, count: 1 });
    }
  }

  return groups;
}

function deriveRecordedWorkflowSteps(groups: readonly RecordedActionGroup[]): string[] {
  return groups
    .slice(0, 50)
    .map(({ action, count }) =>
      action === "pointer"
        ? count === 1
          ? "Select the demonstrated control."
          : `Use the demonstrated controls in sequence (${count} pointer actions).`
        : count === 1
          ? "Enter or edit the required value; the demonstrated text was not retained."
          : `Enter or edit the required values in sequence (${count} keyboard actions); the demonstrated text was not retained.`,
    );
}

export async function createTeachingSkillDraft(
  context: ServiceContext,
  userId: number,
  input: TeachingSkillDraftInput,
): Promise<AuthoredSkillVersionedDocument> {
  const teammateContext = await context.repositories.teammateContexts.getById(
    input.teammateContextId,
  );

  if (!teammateContext || teammateContext.actorUserId !== userId) {
    throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
  }

  const recording = await getTeammateComputerTeachingRecording(
    context,
    input.teammateContextId,
    input.recordingId,
    input.computerFence,
  );

  if (recording.totalActions === 0) {
    throw new AssistantError(
      "Demonstrate at least one action before saving the teaching draft",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (await getSkillDefinition(input.name)) {
    throw new AssistantError(
      `The name ${input.name} is reserved by a built-in skill`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const description = redactSensitiveTokens(input.description);
  const steps = redactSensitiveTokens(input.steps);
  const actionGroups = groupRecordedActions(recording.actions);
  const recordedSteps = deriveRecordedWorkflowSteps(actionGroups);
  const scope = personalSkillScope(userId);
  const draft = buildSkillDocument({
    name: input.name,
    description,
    instructions: `# Recorded workflow draft\n\n${recordedSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n${steps.length > 0 ? `# Reviewer refinements\n\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n` : ""}# Demonstration evidence\n\nObserved ${recording.totalActions} redacted actions (${recording.pointerActions} pointer, ${recording.keyActions} keyboard).\n\nSequence: ${actionGroups.map(({ action, count }) => `${action} × ${count}`).join(" → ")}`,
  });
  const created = await createStoredSkill(
    context,
    scope,
    input.name,
    {
      description,
      content: draft,
      createdByUserId: userId,
      changeNote: `Recorded from a supervised teaching session (${recording.totalActions} redacted actions); review before promotion`,
    },
    { personalEnabled: false },
  );

  const saved = await getStoredSkillVersion(context, scope, input.name, created.draftRevisionId);

  if (!saved) {
    throw new AssistantError("Teaching draft could not be loaded", ErrorType.DATABASE_ERROR);
  }

  return saved;
}
