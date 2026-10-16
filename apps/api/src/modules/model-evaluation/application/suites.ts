import { authorise } from "@ngriffin_uk/polychat-library-policy";
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
import type { Repositories } from "~/infrastructure/database/repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { ModelEvalRepository } from "~/modules/model-evaluation/infrastructure/ModelEvalRepository";
import { ModelGraderRepository } from "~/modules/model-evaluation/infrastructure/ModelGraderRepository";
import {
  badRequest,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { TaskRepository } from "~/modules/tasks/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import { canBatchEvalRoute } from "./batch-runner";
import { toEvalRun, toEvalSuite } from "./mappers";
import { readEvalResults } from "./run-results";

export async function createEvalSuite(
  context: ServiceContext,
  workspaceId: string,
  input: CreateEvalSuiteRequest,
): Promise<EvalSuite> {
  const { userId } = await requireModelAction(context, workspaceId, "build_datasets");
  const projectId = await requireWorkspaceProject(context, workspaceId, input.projectId);
  const graders = await context.repositories
    .get(ModelGraderRepository)
    .list(workspaceId, projectId);
  const missing = input.graderIds.filter((id) => !graders.some((grader) => grader.id === id));

  if (missing.length > 0) {
    throw badRequest(`Unknown graders: ${missing.join(", ")}`);
  }

  const suite = await context.repositories.get(ModelEvalRepository).createSuite({
    workspaceId,
    projectId,
    name: input.name,
    description: input.description ?? null,
    systemPrompt: input.systemPrompt ?? null,
    cases: input.cases,
    graderIds: input.graderIds,
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
  await requireModelAction(context, workspaceId, "view");

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);

  return {
    suites: (
      await context.repositories
        .get(ModelEvalRepository)
        .listSuites(workspaceId, projectId ?? undefined)
    ).map(toEvalSuite),
  };
}

export async function deleteEvalSuite(
  context: ServiceContext,
  workspaceId: string,
  suiteId: string,
): Promise<{ deleted: true }> {
  const access = await requireModelAction(context, workspaceId, "build_datasets");
  const suite = await context.repositories.get(ModelEvalRepository).getSuite(workspaceId, suiteId);

  if (!suite) {
    throw notFound("Eval suite");
  }

  const isAuthorised = authorise("model.suite.delete", {
    actorId: String(access.userId),
    ownerId: String(suite.created_by),
    managesPolicy: access.actions.has("manage_policy"),
  }).allowed;

  if (!isAuthorised) {
    throw new AssistantError(
      "Only the author or an admin can delete this suite",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.get(ModelEvalRepository).deleteSuite(workspaceId, suiteId);

  return { deleted: true };
}

export async function enqueueEvalRun(
  env: IEnv,
  repositories: Repositories,
  input: {
    suite: ModelEvalSuiteRecord;
    route: ModelRouteRecord;
    trigger: ModelEvalRunRecord["trigger"];
    createdBy: number | null;
    batch?: boolean;
  },
): Promise<ModelEvalRunRecord> {
  const run = await repositories.get(ModelEvalRepository).createRun({
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

  await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
    id: `${MODEL_REGISTRY_EVAL_TASK_TYPE}:${run.id}:0`,
    task_type: MODEL_REGISTRY_EVAL_TASK_TYPE,
    task_data: { runId: run.id, offset: 0, readinessAttempt: 0, batch: input.batch === true },
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
  const { userId } = await requireModelAction(context, workspaceId, "deploy");
  const repositories = context.repositories;
  const suite = await repositories.get(ModelEvalRepository).getSuite(workspaceId, suiteId);

  if (!suite) {
    throw notFound("Eval suite");
  }

  const runs: EvalRun[] = [];

  for (const routeId of input.routeIds) {
    const route = await repositories.get(ModelRouteRepository).getRoute(workspaceId, routeId);

    if (!route || route.status !== "active") {
      throw notFound(`Active route ${routeId}`);
    }

    if (input.batch && !canBatchEvalRoute(route)) {
      throw new AssistantError(
        `The ${route.provider} route ${route.provider_model_id} cannot run as a batch. Batches need an OpenAI or Anthropic route without a deployment.`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    runs.push(
      toEvalRun(
        await enqueueEvalRun(context.env, repositories, {
          suite,
          route,
          trigger: "manual",
          createdBy: userId,
          batch: input.batch,
        }),
      ),
    );
  }

  await repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_eval.started",
    targetType: "model_eval_suite",
    targetId: suiteId,
    metadata: {
      routeIds: input.routeIds,
      runIds: runs.map((run) => run.id),
      batch: input.batch,
    },
  });

  return { runs };
}

export async function listEvalRuns(
  context: ServiceContext,
  workspaceId: string,
  suiteId: string,
): Promise<{ runs: EvalRun[] }> {
  await requireModelAction(context, workspaceId, "view");

  const suite = await context.repositories.get(ModelEvalRepository).getSuite(workspaceId, suiteId);

  if (!suite) {
    throw notFound("Eval suite");
  }

  return {
    runs: (
      await context.repositories.get(ModelEvalRepository).listRuns({ suiteIds: [suiteId] })
    ).map(toEvalRun),
  };
}

export async function readEvalCaseResults(
  context: ServiceContext,
  workspaceId: string,
  runId: string,
): Promise<{ results: EvalCaseResult[] }> {
  await requireModelAction(context, workspaceId, "view");

  const run = await context.repositories.get(ModelEvalRepository).getRun(runId);
  const route = run
    ? await context.repositories.get(ModelRouteRepository).getRoute(workspaceId, run.route_id)
    : null;

  if (!run || !route) {
    throw notFound("Eval run");
  }

  return { results: await readEvalResults(context.env.PRIVATE_ASSETS_BUCKET, runId) };
}
