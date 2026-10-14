import type { PlanId } from "@ngriffin_uk/polychat-ai-billing";
import type { CreateJobRequest, Job, JobKind } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";
import type { IUser } from "~/types";

export interface JobScope {
  context: ServiceContext;
  user: IUser;
  projectId?: string;
}

export interface JobRejection {
  error: string;
  detail?: Record<string, unknown>;
}

export interface StartedJobs {
  jobs: Job[];
  rejected: JobRejection[];
}

export type JobInput<TKind extends JobKind> = Extract<CreateJobRequest, { kind: TKind }>["input"];

export interface JobKindDefinition<TKind extends JobKind = JobKind> {
  kind: TKind;
  outputCapability: string;
  projectCapability?: string;
  requiredPlan?: PlanId;
  start(scope: JobScope, input: JobInput<TKind>): Promise<StartedJobs>;
  present(record: OutputRecord): Job | null;
  refresh?(scope: JobScope, record: OutputRecord): Promise<OutputRecord>;
  cancel?(scope: JobScope, record: OutputRecord): Promise<void>;
}

export type JobKindView = Omit<JobKindDefinition, "start">;
