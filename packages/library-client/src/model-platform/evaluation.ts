import type {
  CreateEvalSuiteRequest,
  CreateGraderRequest,
  EvalCaseResult,
  EvalRun,
  EvalSuite,
  Grader,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { platformRequest, segment, workspacePath } from "./request.js";

export async function listGraders(workspaceId: string, projectId?: string): Promise<Grader[]> {
  return (
    await platformRequest<{ graders: Grader[] }>(
      workspacePath(workspaceId, `/graders${toQueryString({ projectId })}`),
    )
  ).graders;
}

export function createGrader(workspaceId: string, input: CreateGraderRequest): Promise<Grader> {
  return platformRequest(workspacePath(workspaceId, "/graders"), { method: "POST", body: input });
}

export function updateGrader(
  workspaceId: string,
  graderId: string,
  input: CreateGraderRequest,
): Promise<Grader> {
  return platformRequest(workspacePath(workspaceId, `/graders/${segment(graderId)}`), {
    method: "PUT",
    body: input,
  });
}

export async function deleteGrader(workspaceId: string, graderId: string): Promise<void> {
  await platformRequest(workspacePath(workspaceId, `/graders/${segment(graderId)}`), {
    method: "DELETE",
  });
}

export function previewGrader(
  workspaceId: string,
  graderId: string,
  input: { output: string; expected?: string },
): Promise<{ score: number | null }> {
  return platformRequest(workspacePath(workspaceId, `/graders/${segment(graderId)}/preview`), {
    method: "POST",
    body: input,
  });
}

export async function listEvalSuites(
  workspaceId: string,
  projectId?: string,
): Promise<EvalSuite[]> {
  return (
    await platformRequest<{ suites: EvalSuite[] }>(
      workspacePath(workspaceId, `/eval-suites${toQueryString({ projectId })}`),
    )
  ).suites;
}

export function createEvalSuite(
  workspaceId: string,
  input: CreateEvalSuiteRequest,
): Promise<EvalSuite> {
  return platformRequest(workspacePath(workspaceId, "/eval-suites"), {
    method: "POST",
    body: input,
  });
}

export async function deleteEvalSuite(workspaceId: string, suiteId: string): Promise<void> {
  await platformRequest(workspacePath(workspaceId, `/eval-suites/${segment(suiteId)}`), {
    method: "DELETE",
  });
}

export async function startEvalRuns(
  workspaceId: string,
  suiteId: string,
  routeIds: string[],
): Promise<EvalRun[]> {
  return (
    await platformRequest<{ runs: EvalRun[] }>(
      workspacePath(workspaceId, `/eval-suites/${segment(suiteId)}/runs`),
      {
        method: "POST",
        body: { routeIds },
      },
    )
  ).runs;
}

export async function listEvalRuns(workspaceId: string, suiteId: string): Promise<EvalRun[]> {
  return (
    await platformRequest<{ runs: EvalRun[] }>(
      workspacePath(workspaceId, `/eval-suites/${segment(suiteId)}/runs`),
    )
  ).runs;
}

export async function listEvalCaseResults(
  workspaceId: string,
  runId: string,
): Promise<EvalCaseResult[]> {
  return (
    await platformRequest<{ results: EvalCaseResult[] }>(
      workspacePath(workspaceId, `/eval-runs/${segment(runId)}/results`),
    )
  ).results;
}
