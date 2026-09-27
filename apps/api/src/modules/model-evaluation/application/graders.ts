import {
  isDeterministicGrader,
  parseJudgeScore,
  buildJudgePrompt,
  scoreDeterministic,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  type CreateGraderRequest,
  createGraderRequestSchema,
  type Grader,
  type GraderConfig,
  parsePlatformChatModelId,
} from "@ngriffin_uk/polychat-schemas";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  conflict,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { completeWorkspaceRoute } from "~/modules/model-serving/application/route-completion";
import { resolveScopedModelRoute } from "~/modules/model-serving/application/scoped-model-route";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import type { IEnv } from "~/types";

import { toGrader } from "./mappers";

export async function scoreWithGrader(
  scope: {
    env: IEnv;
    repositories: RepositoryManager;
    workspaceId: string;
    projectId: string | null;
  },
  config: GraderConfig,
  item: { input: string; output: string; expected?: string },
  judge?: { model: string; provider: string },
): Promise<number | null> {
  if (isDeterministicGrader(config)) {
    return scoreDeterministic(config, item.output, item.expected);
  }

  const prompt = buildJudgePrompt({
    rubric: config.rubric,
    input: item.input,
    output: item.output,
    expected: item.expected,
  });

  if (config.judgeModelId && parsePlatformChatModelId(config.judgeModelId)) {
    const route = await resolveScopedModelRoute(
      scope.repositories,
      scope.workspaceId,
      scope.projectId,
      config.judgeModelId,
    );

    return parseJudgeScore(
      await completeWorkspaceRoute(scope.env, scope.repositories, route, prompt, null),
    );
  }

  const { env } = scope;
  const model = config.judgeModelId
    ? { model: config.judgeModelId, provider: undefined }
    : (judge ?? (await getAuxiliaryModel(env)));
  const verdict = await ai.complete({
    env,
    model: model.model,
    provider: model.provider,
    prompt,
  });

  return parseJudgeScore(verdict.text);
}

export async function listGraders(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<{ graders: Grader[] }> {
  await requireModelAction(context, workspaceId, "view");

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);

  return {
    graders: (await context.repositories.modelGraders.list(workspaceId, projectId)).map(toGrader),
  };
}

export async function createGrader(
  context: ServiceContext,
  workspaceId: string,
  input: CreateGraderRequest,
): Promise<Grader> {
  const { userId } = await requireModelAction(context, workspaceId, "build_datasets");
  const request = createGraderRequestSchema.parse(input);
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const existing = await context.repositories.modelGraders.list(workspaceId, projectId);

  if (
    existing.some((grader) => grader.metric === request.metric && grader.project_id === projectId)
  ) {
    throw conflict(`A grader already scores ${request.metric} here`);
  }

  const grader = await context.repositories.modelGraders.create({
    workspaceId,
    projectId,
    name: request.name,
    metric: request.metric,
    description: request.description ?? null,
    config: request.config,
    createdBy: userId,
  });

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_grader.created",
    targetType: "model_grader",
    targetId: grader.id,
    metadata: { metric: request.metric, kind: request.config.kind },
  });

  return toGrader(grader);
}

export async function updateGrader(
  context: ServiceContext,
  workspaceId: string,
  graderId: string,
  input: CreateGraderRequest,
): Promise<Grader> {
  const { userId } = await requireModelAction(context, workspaceId, "build_datasets");
  const request = createGraderRequestSchema.parse(input);
  const grader = await context.repositories.modelGraders.get(workspaceId, graderId);

  if (!grader) {
    throw notFound("Grader");
  }

  const updated = await context.repositories.modelGraders.update(graderId, {
    name: request.name,
    description: request.description ?? null,
    config: request.config,
    revision: grader.revision + 1,
  });

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_grader.revised",
    targetType: "model_grader",
    targetId: graderId,
    metadata: { revision: updated.revision, kind: request.config.kind },
  });

  return toGrader(updated);
}

export async function deleteGrader(
  context: ServiceContext,
  workspaceId: string,
  graderId: string,
): Promise<{ deleted: true }> {
  const { userId } = await requireModelAction(context, workspaceId, "build_datasets");
  const suites = await context.repositories.modelEvals.listSuites(workspaceId);

  if (suites.some((suite) => suite.grader_ids.includes(graderId))) {
    throw conflict("A suite still uses this grader");
  }

  await context.repositories.modelGraders.delete(workspaceId, graderId);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_grader.deleted",
    targetType: "model_grader",
    targetId: graderId,
  });

  return { deleted: true };
}

export async function previewGrader(
  context: ServiceContext,
  workspaceId: string,
  graderId: string,
  input: { output: string; expected?: string },
): Promise<{ score: number | null }> {
  await requireModelAction(context, workspaceId, "view");

  const grader = await context.repositories.modelGraders.get(workspaceId, graderId);

  if (!grader) {
    throw notFound("Grader");
  }

  return {
    score: await scoreWithGrader(
      {
        env: context.env,
        repositories: context.repositories,
        workspaceId,
        projectId: grader.project_id,
      },
      grader.config,
      {
        input: "",
        output: input.output,
        expected: input.expected,
      },
    ),
  };
}
