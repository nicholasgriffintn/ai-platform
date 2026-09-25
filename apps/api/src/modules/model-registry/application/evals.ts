import {
  MODEL_REGISTRY_EVAL_TASK_TYPE,
  type CreateEvalSuiteRequest,
  type EvalCaseResult,
  type EvalRun,
  type EvalSuite,
  type StartEvalRunsRequest,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import type { ModelRouteRecord } from "../infrastructure/ModelRouteRepository";
import { notFound, requireRegistryMember, requireWorkspaceProject } from "./access";
import { readEvalResults } from "./eval-runner";
import { toEvalRun, toEvalSuite } from "./mappers";

export async function createEvalSuite(
  context: ServiceContext,
  workspaceId: string,
  input: CreateEvalSuiteRequest,
): Promise<EvalSuite> {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const projectId = await requireWorkspaceProject(context, workspaceId, input.projectId);
  const suite = await context.repositories.modelEvals.createSuite({
    workspaceId,
    projectId,
    name: input.name,
    description: input.description ?? null,
    systemPrompt: input.systemPrompt ?? null,
    cases: input.cases,
    scorers: input.scorers,
    replaySampleSize: input.replaySampleSize,
    createdBy: userId,
  });

  return toEvalSuite(suite);
}

export async function listEvalSuites(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<{ suites: EvalSuite[] }> {
  await requireRegistryMember(context, workspaceId);

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);

  return {
    suites: (
      await context.repositories.modelEvals.listSuites(workspaceId, projectId ?? undefined)
    ).map(toEvalSuite),
  };
}

export async function deleteEvalSuite(
  context: ServiceContext,
  workspaceId: string,
  suiteId: string,
): Promise<{ deleted: true }> {
  const access = await requireRegistryMember(context, workspaceId);
  const suite = await context.repositories.modelEvals.getSuite(workspaceId, suiteId);

  if (!suite) {
    throw notFound("Eval suite");
  }

  if (suite.created_by !== access.userId && !access.canGovern) {
    throw new AssistantError(
      "Only the author or an admin can delete this suite",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.modelEvals.deleteSuite(workspaceId, suiteId);

  return { deleted: true };
}

export async function enqueueEvalRun(
  env: IEnv,
  repositories: RepositoryManager,
  input: {
    suite: ModelEvalSuiteRecord;
    route: ModelRouteRecord;
    trigger: "manual" | "build" | "replay";
    createdBy: number | null;
  },
): Promise<ModelEvalRunRecord> {
  const run = await repositories.modelEvals.createRun({
    suiteId: input.suite.id,
    routeId: input.route.id,
    versionId: input.route.version_id,
    trigger: input.trigger,
    casesTotal:
      input.trigger === "replay"
        ? Math.min(input.suite.cases.length, input.suite.replay_sample_size)
        : input.suite.cases.length,
    createdBy: input.createdBy,
  });

  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_REGISTRY_EVAL_TASK_TYPE}:${run.id}:0`,
    task_type: MODEL_REGISTRY_EVAL_TASK_TYPE,
    task_data: { runId: run.id, offset: 0, readinessAttempt: 0 },
    priority: 6,
  });

  return run;
}

export async function startEvalRuns(
  context: ServiceContext,
  workspaceId: string,
  suiteId: string,
  input: StartEvalRunsRequest,
): Promise<{ runs: EvalRun[] }> {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const repositories = context.repositories;
  const suite = await repositories.modelEvals.getSuite(workspaceId, suiteId);

  if (!suite) {
    throw notFound("Eval suite");
  }

  const runs: EvalRun[] = [];

  for (const routeId of input.routeIds) {
    const route = await repositories.modelRoutes.getRoute(workspaceId, routeId);

    if (!route || route.status !== "active") {
      throw notFound(`Active route ${routeId}`);
    }

    runs.push(
      toEvalRun(
        await enqueueEvalRun(context.env, repositories, {
          suite,
          route,
          trigger: "manual",
          createdBy: userId,
        }),
      ),
    );
  }

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_eval.started",
    targetType: "model_eval_suite",
    targetId: suiteId,
    metadata: { routeIds: input.routeIds, runIds: runs.map((run) => run.id) },
  });

  return { runs };
}

export async function listEvalRuns(
  context: ServiceContext,
  workspaceId: string,
  suiteId: string,
): Promise<{ runs: EvalRun[] }> {
  await requireRegistryMember(context, workspaceId);

  const suite = await context.repositories.modelEvals.getSuite(workspaceId, suiteId);

  if (!suite) {
    throw notFound("Eval suite");
  }

  return {
    runs: (await context.repositories.modelEvals.listRuns({ suiteIds: [suiteId] })).map(toEvalRun),
  };
}

export async function readEvalCaseResults(
  context: ServiceContext,
  workspaceId: string,
  runId: string,
): Promise<{ results: EvalCaseResult[] }> {
  await requireRegistryMember(context, workspaceId);

  const run = await context.repositories.modelEvals.getRun(runId);
  const route = run
    ? await context.repositories.modelRoutes.getRoute(workspaceId, run.route_id)
    : null;

  if (!run || !route) {
    throw notFound("Eval run");
  }

  return { results: await readEvalResults(context.env.PRIVATE_ASSETS_BUCKET, runId) };
}
