import type {
  CreateProjectTaskInput,
  ProjectFlow,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

export interface TaskDraft {
  objective: string;
  criteria: { id: number; text: string }[];
  expectedOutput: string;
  contextNotes: string;
  assignee: string;
  stageId: string;
  teammateId: string;
  showAdvanced: boolean;
  constraintNotes: string;
  dependsOn: string[];
  requireApprovalFor: ToolPermission[];
  tokenBudget: string;
}

export function createTaskDraft(flow: ProjectFlow | null): TaskDraft {
  return {
    objective: "",
    criteria: [{ id: 1, text: "" }],
    expectedOutput: "",
    contextNotes: "",
    assignee: "",
    stageId: flow?.stages[0]?.id ?? "",
    teammateId: "",
    showAdvanced: false,
    constraintNotes: "",
    dependsOn: [],
    requireApprovalFor: [],
    tokenBudget: "",
  };
}

export function taskDraftInput(draft: TaskDraft): CreateProjectTaskInput {
  return {
    objective: draft.objective.trim(),
    acceptanceCriteria: draft.criteria
      .map((criterion) => criterion.text.trim())
      .filter(Boolean)
      .map((text) => ({ text })),
    expectedOutput: draft.expectedOutput.trim() || null,
    context: draft.contextNotes.trim() ? { links: [], notes: draft.contextNotes.trim() } : null,
    constraints: draft.constraintNotes.trim()
      ? { forbiddenTools: [], notes: draft.constraintNotes.trim() }
      : null,
    dependsOnTaskIds: draft.dependsOn,
    requireApprovalFor: draft.requireApprovalFor,
    assigneeUserId: draft.assignee ? Number(draft.assignee) : null,
    runner:
      !draft.stageId && draft.teammateId
        ? { kind: "conversation", teammateId: draft.teammateId, model: null, mode: null }
        : null,
    stageId: draft.stageId || null,
    tokenBudget: draft.tokenBudget ? Number(draft.tokenBudget) : null,
  };
}
