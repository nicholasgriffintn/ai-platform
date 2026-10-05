import {
  PROJECT_TASK_PLAN_EVIDENCE_PROTOCOL_VERSION,
  type ChatRun,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskPlanEvidence,
  type ProjectTaskResumeCapability,
  type ProjectTaskNodeEvidence,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { hydrateChatRunUsage } from "~/modules/chat-runs/application/usage";
import {
  createChatRunProvenance,
  parseOutputProvenance,
} from "~/modules/outputs/application/provenance";
import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

const ACTIVE_RUN_STATUSES = new Set([
  "accepted",
  "running",
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
  "cancelling",
]);

function stageEvidenceId(taskId: string, nodeId: string | null): string {
  return `${taskId}:${nodeId ?? "task"}`;
}

export function getProjectTaskResumeCapability(
  task: ProjectTask,
  unsafeRunIds: ReadonlySet<string>,
): ProjectTaskResumeCapability {
  if (task.status === "backlog" || (task.status === "queued" && !task.dispatchTaskId)) {
    return { supported: true, reason: null };
  }

  if (task.status === "blocked" && task.blockedReason === "dispatch_failed") {
    return { supported: true, reason: null };
  }

  if (task.status === "blocked" && task.blockedReason === "run_failed") {
    if (task.runId && unsafeRunIds.has(task.runId)) {
      return {
        supported: false,
        reason:
          "This attempt consumed an external-operation approval. Reconcile the provider before creating new work; Polychat will not rerun the stage blindly.",
      };
    }

    return { supported: true, reason: null };
  }

  return {
    supported: false,
    reason:
      task.status === "cancelled"
        ? "This plan was abandoned. Completed stage evidence is retained; create a new task to run changed work."
        : "This stage is not at a safe retry boundary.",
  };
}

function stageStatus(params: {
  task: ProjectTask;
  attempts: ChatRun[];
  completionCount: number;
}): ProjectTaskNodeEvidence["status"] {
  if (params.completionCount > 0) {
    return "completed";
  }

  const latest = params.attempts.at(-1);

  if (latest && ACTIVE_RUN_STATUSES.has(latest.status)) {
    return "executing";
  }

  if (latest?.status === "failed") {
    return "failed";
  }

  if (latest && ["interrupted", "cancelled", "succeeded"].includes(latest.status)) {
    return "interrupted";
  }

  return params.task.status === "cancelled" ? "abandoned" : "proposed";
}

export function buildProjectTaskPlanEvidence(params: {
  task: ProjectTask;
  flow: ProjectFlow | null;
  runs: ChatRun[];
  outputs: OutputRecord[];
  unsafeRunIds: ReadonlySet<string>;
}): ProjectTaskPlanEvidence {
  const { task, flow } = params;
  const nodeIds = new Set<string | null>();

  for (const stage of flow?.nodes ?? []) {
    nodeIds.add(stage.id);
  }

  for (const completion of task.completions) {
    nodeIds.add(completion.nodeId);
  }

  for (const run of params.runs) {
    nodeIds.add(run.nodeId ?? null);
  }

  if (nodeIds.size === 0) {
    nodeIds.add(task.nodeId);
  }

  const outputsByRun = new Map<string, OutputRecord[]>();

  for (const output of params.outputs) {
    const runId = parseOutputProvenance(output.provenance_json, output.created_at).run?.id;

    if (runId) {
      outputsByRun.set(runId, [...(outputsByRun.get(runId) ?? []), output]);
    }
  }

  const stages = [...nodeIds].map((nodeId): ProjectTaskNodeEvidence => {
    const definition = flow?.nodes.find((stage) => stage.id === nodeId);
    const attempts = params.runs.filter((run) => (run.nodeId ?? null) === nodeId);
    const completions = task.completions.filter((completion) => completion.nodeId === nodeId);
    const stageOutputs = attempts.flatMap((run) => outputsByRun.get(run.id) ?? []);

    return {
      id: stageEvidenceId(task.id, nodeId),
      flowNodeId: nodeId,
      name: definition?.name ?? (nodeId ? nodeId.replace(/[-_]+/g, " ") : "Task"),
      status: stageStatus({ task, attempts, completionCount: completions.length }),
      input: {
        objective: task.objective,
        acceptanceCriterionIds: task.acceptanceCriteria.map((criterion) => criterion.id),
      },
      attempts: attempts.map((run) => {
        const outputs = outputsByRun.get(run.id) ?? [];

        return {
          id: `${run.id}:${run.attempt}`,
          runId: run.id,
          conversationId: run.conversationId,
          attempt: run.attempt,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          terminalReason: run.terminalReason,
          provenance: createChatRunProvenance(run),
          completionIds: completions
            .filter((completion) => completion.runId === run.id)
            .map((completion) => completion.id),
          outputs: outputs.map((output) => ({
            id: output.id,
            title: output.title,
            kind: output.kind,
            status: output.status,
          })),
          usage: run.usage,
        };
      }),
      completionIds: completions.map((completion) => completion.id),
      outputs: stageOutputs.map((output) => ({
        id: output.id,
        title: output.title,
        kind: output.kind,
        status: output.status,
      })),
    };
  });

  return {
    protocolVersion: PROJECT_TASK_PLAN_EVIDENCE_PROTOCOL_VERSION,
    id: task.id,
    status:
      task.status === "done" ? "completed" : task.status === "cancelled" ? "abandoned" : "active",
    nodes: stages,
    resume: getProjectTaskResumeCapability(task, params.unsafeRunIds),
  };
}

export async function getProjectTaskPlanEvidence(
  context: ServiceContext,
  task: ProjectTask,
): Promise<ProjectTaskPlanEvidence> {
  const runRecords = await context.repositories.conversationRuns.listForProjectTask(
    task.projectId,
    task.id,
  );
  const runs = await hydrateChatRunUsage(context.repositories, runRecords);
  const runIds = runs.map((run) => run.id);
  const [outputs, unsafeRunIds] = await Promise.all([
    context.repositories.outputs.listProjectOutputsForRuns(task.projectId, runIds),
    context.repositories.connectorOperationApprovals.listConsumedRunIds(runIds),
  ]);

  return buildProjectTaskPlanEvidence({
    task,
    flow: task.flowSnapshot,
    runs,
    outputs,
    unsafeRunIds,
  });
}
