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
): Promise<FineTuningJob> {
	return requestFinetuneWorker(env, "/jobs", fineTuningJobSchema, {
		method: "POST",
		body: finetuneWorkerStartJobSchema.parse(request),
	});
}

export async function getFinetuneWorkerJob(
	env: IEnv,
	providerId: FineTuningProviderId,
	jobName: string,
): Promise<FineTuningJob> {
	return requestFinetuneWorker(
		env,
		`/jobs/${encodeURIComponent(providerId)}/${encodeURIComponent(jobName)}`,
		fineTuningJobSchema,
	);
}

export async function listFinetuneWorkerJobs(env: IEnv, userId: number): Promise<FineTuningJob[]> {
	const response = await requestFinetuneWorker(
		env,
		`/jobs?userId=${encodeURIComponent(String(userId))}`,
		fineTuningJobsResponseSchema,
	);
	return response.jobs;
}

export async function listFinetuneWorkerJobEvents(
	env: IEnv,
	providerId: FineTuningProviderId,
	jobName: string,
): Promise<FineTuningJobEvent[]> {
	const response = await requestFinetuneWorker(
		env,
		`/jobs/${encodeURIComponent(providerId)}/${encodeURIComponent(jobName)}/events`,
		fineTuningJobEventsResponseSchema,
	);

	return response.events;
}

export async function deployFinetuneWorkerModel(
	env: IEnv,
	request: FinetuneWorkerDeployModelRequest,
): Promise<FineTunedDeployment> {
	return requestFinetuneWorker(env, "/deployments", fineTunedDeploymentSchema, {
		method: "POST",
		body: finetuneWorkerDeployModelSchema.parse(request),
	});
}

export async function getFinetuneWorkerDeployment(
	env: IEnv,
	providerId: FineTuningProviderId,
	endpointName: string,
): Promise<FineTunedDeployment> {
	return requestFinetuneWorker(
		env,
		`/deployments/${encodeURIComponent(providerId)}/${encodeURIComponent(endpointName)}`,
		fineTunedDeploymentSchema,
	);
}

export async function listFinetuneWorkerDeployments(
	env: IEnv,
	userId: number,
): Promise<FineTunedDeployment[]> {
	const response = await requestFinetuneWorker(
		env,
		`/deployments?userId=${encodeURIComponent(String(userId))}`,
		fineTunedDeploymentsResponseSchema,
	);
	return response.deployments;
}
