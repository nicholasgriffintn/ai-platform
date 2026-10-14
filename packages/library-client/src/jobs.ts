import {
  jobSchema,
  startedJobListSchema,
  type CreateJobRequest,
  type Job,
  type JobKind,
  type JobOf,
  type StartedJobList,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource, withQuery } from "./resource.js";

export const jobs = resource<Job>("/jobs");

function isJobOf<TKind extends JobKind>(kind: TKind, job: Job): job is JobOf<TKind> {
  return job.kind === kind;
}

export async function startJobs(request: CreateJobRequest): Promise<StartedJobList> {
  return startedJobListSchema.parse(
    await requestJson<unknown>("/jobs", "POST", request, { timeoutMs: null }),
  );
}

export async function startJobOfKind<TKind extends JobKind>(
  request: Extract<CreateJobRequest, { kind: TKind }>,
): Promise<JobOf<TKind>> {
  const started = await startJobs(request);
  const job = started.data.find((candidate): candidate is JobOf<TKind> =>
    isJobOf(request.kind, candidate),
  );

  if (!job) {
    throw new Error(started.rejected[0]?.error ?? `The ${request.kind} job was not started`);
  }

  return job;
}

export async function listJobsOfKind<TKind extends JobKind>(
  kind: TKind,
  query: { project_id?: string; external_id?: string } = {},
): Promise<JobOf<TKind>[]> {
  const listed = await jobs.listAll({ kind, ...query });

  return listed.map((job) => jobSchema.parse(job)).filter((job) => isJobOf(kind, job));
}

export async function readJobOfKind<TKind extends JobKind>(
  kind: TKind,
  jobId: string,
  projectId?: string,
): Promise<JobOf<TKind>> {
  const job = jobSchema.parse(
    await requestJson<unknown>(
      withQuery(`/jobs/${encodeURIComponent(jobId)}`, { kind, project_id: projectId }),
      "GET",
    ),
  );

  if (!isJobOf(kind, job)) {
    throw new Error(`Job ${jobId} is not a ${kind} job`);
  }

  return job;
}

export async function cancelJob(jobId: string, kind?: JobKind): Promise<Job> {
  return jobSchema.parse(
    await requestJson<unknown>(
      withQuery(`/jobs/${encodeURIComponent(jobId)}/cancel`, { kind }),
      "POST",
      {},
    ),
  );
}
