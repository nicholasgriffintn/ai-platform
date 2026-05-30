import {
	trainingWorkerDeployModelSchema,
	trainingWorkerStartJobSchema,
	trainingDeploymentDeleteResponseSchema,
	trainingDeploymentSchema,
	trainingDeploymentsResponseSchema,
	trainingJobEventsResponseSchema,
	trainingJobsResponseSchema,
	trainingJobSchema,
	type TrainingDeployment,
	type TrainingDeploymentDeleteResponse,
	type TrainingJob,
	type TrainingJobEvent,
	type TrainingProviderId,
	type TrainingWorkerDeployModelRequest,
	type TrainingWorkerStartJobRequest,
} from "@assistant/schemas";

import type { IEnv } from "~/types";
import { requestTrainingWorker } from "./trainingWorkerHttp";

export async function startTrainingWorkerJob(
	env: IEnv,
	request: TrainingWorkerStartJobRequest,
	userId: number,
): Promise<TrainingJob> {
	const body = trainingWorkerStartJobSchema.parse(request);
	return requestTrainingWorker(env, "/jobs", trainingJobSchema, {
		method: "POST",
		body,
		userId,
	});
}

export async function getTrainingWorkerJob(
	env: IEnv,
	providerId: TrainingProviderId,
	jobName: string,
	userId: number,
): Promise<TrainingJob> {
	return requestTrainingWorker(
		env,
		`/jobs/${encodeURIComponent(providerId)}/${encodeURIComponent(jobName)}`,
		trainingJobSchema,
		{ userId },
	);
}

export async function listTrainingWorkerJobs(env: IEnv, userId: number): Promise<TrainingJob[]> {
	const response = await requestTrainingWorker(env, "/jobs", trainingJobsResponseSchema, {
		userId,
	});
	return response.jobs;
}

export async function listTrainingWorkerJobEvents(
	env: IEnv,
	providerId: TrainingProviderId,
	jobName: string,
	userId: number,
): Promise<TrainingJobEvent[]> {
	const response = await requestTrainingWorker(
		env,
		`/jobs/${encodeURIComponent(providerId)}/${encodeURIComponent(jobName)}/events`,
		trainingJobEventsResponseSchema,
		{ userId },
	);

	return response.events;
}

export async function listTrainingWorkerDeploymentEvents(
	env: IEnv,
	providerId: TrainingProviderId,
	endpointName: string,
	userId: number,
): Promise<TrainingJobEvent[]> {
	const response = await requestTrainingWorker(
		env,
		`/deployments/${encodeURIComponent(providerId)}/${encodeURIComponent(endpointName)}/events`,
		trainingJobEventsResponseSchema,
		{ userId },
	);

	return response.events;
}

export async function deployTrainingWorkerModel(
	env: IEnv,
	request: TrainingWorkerDeployModelRequest,
	userId: number,
): Promise<TrainingDeployment> {
	const body = trainingWorkerDeployModelSchema.parse(request);
	return requestTrainingWorker(env, "/deployments", trainingDeploymentSchema, {
		method: "POST",
		body,
		userId,
	});
}

export async function getTrainingWorkerDeployment(
	env: IEnv,
	providerId: TrainingProviderId,
	endpointName: string,
	userId: number,
): Promise<TrainingDeployment> {
	return requestTrainingWorker(
		env,
		`/deployments/${encodeURIComponent(providerId)}/${encodeURIComponent(endpointName)}`,
		trainingDeploymentSchema,
		{ userId },
	);
}

export async function listTrainingWorkerDeployments(
	env: IEnv,
	userId: number,
): Promise<TrainingDeployment[]> {
	const response = await requestTrainingWorker(
		env,
		"/deployments",
		trainingDeploymentsResponseSchema,
		{ userId },
	);
	return response.deployments;
}

export async function deleteTrainingWorkerDeployment(
	env: IEnv,
	providerId: TrainingProviderId,
	endpointName: string,
	userId: number,
): Promise<TrainingDeploymentDeleteResponse> {
	return requestTrainingWorker(
		env,
		`/deployments/${encodeURIComponent(providerId)}/${encodeURIComponent(endpointName)}`,
		trainingDeploymentDeleteResponseSchema,
		{
			method: "DELETE",
			userId,
		},
	);
}
