import {
  TERMINAL_JOB_STATUSES,
  toListPage,
  type CreateJobRequest,
  type Job,
  type JobKind,
  type ListJobsQuery,
  type ListPage,
  type ReadJobQuery,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { assertPlanEntitlement } from "~/middleware/requirePlan";
import {
  requireOptionalProjectCapabilityAccess,
  requireProjectAccess,
} from "~/modules/workspaces/application/access";
import type { IUser } from "~/types";

import type {
  JobInput,
  JobKindDefinition,
  JobKindView,
  JobRejection,
  JobScope,
  StartedJobs,
} from "../domain/job-kind";
import { listScopedOutputGroup, listScopedOutputs, requireScopedOutput } from "./outputs";
import { JOB_KIND_DEFINITIONS, JOB_KIND_LIST } from "./registry";

async function scopeFor(
  context: ServiceContext,
  user: IUser,
  projectId: string | undefined,
  definition?: JobKindView,
): Promise<JobScope> {
  if (projectId) {
    if (definition?.projectCapability) {
      await requireOptionalProjectCapabilityAccess(
        context,
        projectId,
        "app",
        definition.projectCapability,
      );
    } else {
      await requireProjectAccess(context, projectId);
    }
  }

  return { context, user, projectId };
}

async function startKind<TKind extends JobKind>(
  context: ServiceContext,
  user: IUser,
  definition: JobKindDefinition<TKind>,
  projectId: string | undefined,
  input: JobInput<TKind>,
): Promise<StartedJobs> {
  if (definition.requiredPlan) {
    assertPlanEntitlement(user, definition.requiredPlan);
  }

  return definition.start(await scopeFor(context, user, projectId, definition), input);
}

function startRequest(
  context: ServiceContext,
  user: IUser,
  request: CreateJobRequest,
): Promise<StartedJobs> {
  switch (request.kind) {
    case "ocr_batch":
      return startKind(
        context,
        user,
        JOB_KIND_DEFINITIONS.ocr_batch,
        request.project_id,
        request.input,
      );
    case "research":
      return startKind(
        context,
        user,
        JOB_KIND_DEFINITIONS.research,
        request.project_id,
        request.input,
      );
    case "site_evaluation":
      return startKind(
        context,
        user,
        JOB_KIND_DEFINITIONS.site_evaluation,
        request.project_id,
        request.input,
      );
  }
}

export async function startJobs(
  context: ServiceContext,
  user: IUser,
  request: CreateJobRequest,
): Promise<ListPage<Job> & { rejected: JobRejection[] }> {
  const { jobs, rejected } = await startRequest(context, user, request);

  if (jobs.length === 0 && rejected[0]) {
    throw new AssistantError(rejected[0].error, ErrorType.PARAMS_ERROR, 400);
  }

  return { ...toListPage(jobs, jobs.length, (job) => job.id), rejected };
}

function compareJobs(left: Job, right: Job): number {
  return right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id);
}

export async function listJobs(
  context: ServiceContext,
  user: IUser,
  query: ListJobsQuery,
): Promise<ListPage<Job>> {
  const definitions: JobKindView[] = query.kind
    ? [JOB_KIND_DEFINITIONS[query.kind]]
    : JOB_KIND_LIST;
  const scope = await scopeFor(context, user, query.project_id, definitions[0]);
  const batches = await Promise.all(
    definitions.map(async (definition) => {
      const records = query.external_id
        ? await listScopedOutputGroup(scope, definition.outputCapability, query.external_id)
        : await listScopedOutputs(scope, definition.outputCapability);

      return records.flatMap((record) => {
        const job = definition.present(record);

        return job ? [job] : [];
      });
    }),
  );
  const jobs = batches.flat().sort(compareJobs);
  const start = query.after ? jobs.findIndex((job) => job.id === query.after) + 1 : 0;

  return toListPage(jobs.slice(start, start + query.limit + 1), query.limit, (job) => job.id);
}

function definitionFor(job: Job): JobKindView {
  return JOB_KIND_DEFINITIONS[job.kind];
}

export async function readJob(
  context: ServiceContext,
  user: IUser,
  jobId: string,
  query: ReadJobQuery,
): Promise<Job> {
  const scope = await scopeFor(
    context,
    user,
    query.project_id,
    query.kind ? JOB_KIND_DEFINITIONS[query.kind] : undefined,
  );
  const record = await requireScopedOutput(scope, jobId);
  const definitions: JobKindView[] = query.kind
    ? [JOB_KIND_DEFINITIONS[query.kind]]
    : JOB_KIND_LIST;
  const definition = definitions.find((candidate) => candidate.present(record));
  const job = definition?.present(record);

  if (!definition || !job) {
    throw new AssistantError("Job not found", ErrorType.NOT_FOUND, 404);
  }

  if (!definition.refresh || TERMINAL_JOB_STATUSES.has(job.status)) {
    return job;
  }

  return definition.present(await definition.refresh(scope, record)) ?? job;
}

export async function cancelJob(
  context: ServiceContext,
  user: IUser,
  jobId: string,
  query: ReadJobQuery,
): Promise<Job> {
  const job = await readJob(context, user, jobId, query);
  const definition = definitionFor(job);

  if (TERMINAL_JOB_STATUSES.has(job.status)) {
    throw new AssistantError("The job has already finished", ErrorType.CONFLICT_ERROR, 409);
  }

  if (!definition.cancel) {
    throw new AssistantError("This kind of job cannot be cancelled", ErrorType.CONFLICT_ERROR, 409);
  }

  const scope = await scopeFor(context, user, query.project_id, definition);

  await definition.cancel(scope, await requireScopedOutput(scope, jobId));

  return readJob(context, user, jobId, query);
}
