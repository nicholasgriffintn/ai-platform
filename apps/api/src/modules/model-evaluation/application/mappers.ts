import type { EvalRun, EvalSuite, Grader } from "@ngriffin_uk/polychat-schemas";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import type { ModelGraderRecord } from "../infrastructure/ModelGraderRepository";

export function toEvalSuite(record: ModelEvalSuiteRecord): EvalSuite {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    name: record.name,
    description: record.description,
    systemPrompt: record.system_prompt,
    cases: record.cases,
    graderIds: record.grader_ids,
    replaySampleSize: record.replay_sample_size,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function toEvalRun(record: ModelEvalRunRecord): EvalRun {
  return {
    id: record.id,
    suiteId: record.suite_id,
    routeId: record.route_id,
    versionId: record.version_id,
    trigger: record.trigger,
    status: record.status,
    scores: record.scores,
    latencyP95Ms: record.latency_p95_ms,
    casesCompleted: record.cases_completed,
    casesTotal: record.cases_total,
    failureReason: record.failure_reason,
    createdAt: record.created_at,
    completedAt: record.completed_at,
  };
}

export function toGrader(record: ModelGraderRecord): Grader {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    name: record.name,
    metric: record.metric,
    description: record.description,
    config: record.config,
    revision: record.revision,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
