import type {
  StartTrainingRunRequest,
  TrainingPlan,
  TrainingPlanRequest,
  TrainingRecommendation,
  TrainingRecommendationRequest,
  TrainingRun,
  TrainingRunSummary,
  TrainingStartResult,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { platformRequest, segment, workspacePath } from "./request.js";

export function recommendTraining(
  workspaceId: string,
  input: TrainingRecommendationRequest,
): Promise<TrainingRecommendation> {
  return platformRequest(workspacePath(workspaceId, "/training/recommend"), {
    method: "POST",
    body: input,
  });
}

export function planTraining(
  workspaceId: string,
  input: TrainingPlanRequest,
): Promise<TrainingPlan> {
  return platformRequest(workspacePath(workspaceId, "/training/plan"), {
    method: "POST",
    body: input,
  });
}

export async function listTrainingRuns(
  workspaceId: string,
  projectId?: string,
): Promise<TrainingRunSummary[]> {
  return (
    await platformRequest<{ runs: TrainingRunSummary[] }>(
      workspacePath(workspaceId, `/training/runs${toQueryString({ projectId })}`),
    )
  ).runs;
}

export function startTrainingRun(
  workspaceId: string,
  input: StartTrainingRunRequest,
): Promise<TrainingStartResult> {
  return platformRequest(workspacePath(workspaceId, "/training/runs"), {
    method: "POST",
    body: input,
  });
}

export function getTrainingRun(workspaceId: string, runId: string): Promise<TrainingRun> {
  return platformRequest(workspacePath(workspaceId, `/training/runs/${segment(runId)}`));
}

export function cancelTrainingRun(workspaceId: string, runId: string): Promise<TrainingRun> {
  return platformRequest(workspacePath(workspaceId, `/training/runs/${segment(runId)}/cancel`), {
    method: "POST",
  });
}
