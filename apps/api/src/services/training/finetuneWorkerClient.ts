import {
	finetuneWorkerDeployModelSchema,
	finetuneWorkerStartJobSchema,
	fineTunedDeploymentSchema,
	fineTunedDeploymentsResponseSchema,
	fineTuningJobEventsResponseSchema,
	fineTuningJobsResponseSchema,
	fineTuningJobSchema,
	type FineTunedDeployment,
	type FineTuningJob,
	type FineTuningJobEvent,
	type FineTuningProviderId,
	type FinetuneWorkerDeployModelRequest,
	type FinetuneWorkerStartJobRequest,
} from "@assistant/schemas";

import type { IEnv } from "~/types";
import { requestFinetuneWorker } from "./finetuneWorkerHttp";

export async function startFinetuneWorkerJob(
	env: IEnv,
	request: FinetuneWorkerStartJobRequest,
	userId: number,
): Promise<FineTuningJob> {
	const body = finetuneWorkerStartJobSchema.parse(request);
	return requestFinetuneWorker(env, "/jobs", fineTuningJobSchema, {
		method: "POST",
		body,
		userId,
	});
}

export async function getFinetuneWorkerJob(
	env: IEnv,
	providerId: FineTuningProviderId,
	jobName: string,
	userId: number,
): Promise<FineTuningJob> {
	return requestFinetuneWorker(
		env,
		`/jobs/${encodeURIComponent(providerId)}/${encodeURIComponent(jobName)}`,
		fineTuningJobSchema,
		{ userId },
	);
}

export async function listFinetuneWorkerJobs(env: IEnv, userId: number): Promise<FineTuningJob[]> {
	const response = await requestFinetuneWorker(env, "/jobs", fineTuningJobsResponseSchema, {
		userId,
	});
	return response.jobs;
}

export async function listFinetuneWorkerJobEvents(
	env: IEnv,
	providerId: FineTuningProviderId,
	jobName: string,
	userId: number,
): Promise<FineTuningJobEvent[]> {
	const response = await requestFinetuneWorker(
		env,
		`/jobs/${encodeURIComponent(providerId)}/${encodeURIComponent(jobName)}/events`,
		fineTuningJobEventsResponseSchema,
		{ userId },
	);

	return response.events;
}

export async function deployFinetuneWorkerModel(
	env: IEnv,
	request: FinetuneWorkerDeployModelRequest,
	userId: number,
): Promise<FineTunedDeployment> {
	const body = finetuneWorkerDeployModelSchema.parse(request);
	return requestFinetuneWorker(env, "/deployments", fineTunedDeploymentSchema, {
		method: "POST",
		body,
		userId,
	});
}

export async function getFinetuneWorkerDeployment(
	env: IEnv,
	providerId: FineTuningProviderId,
	endpointName: string,
	userId: number,
): Promise<FineTunedDeployment> {
	return requestFinetuneWorker(
		env,
		`/deployments/${encodeURIComponent(providerId)}/${encodeURIComponent(endpointName)}`,
		fineTunedDeploymentSchema,
		{ userId },
	);
}

export async function listFinetuneWorkerDeployments(
	env: IEnv,
	userId: number,
): Promise<FineTunedDeployment[]> {
	const response = await requestFinetuneWorker(
		env,
		"/deployments",
		fineTunedDeploymentsResponseSchema,
		{ userId },
	);
	return response.deployments;
}
