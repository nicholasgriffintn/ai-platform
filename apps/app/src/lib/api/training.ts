import type {
	DeployFineTunedModelRequest,
	FineTunedDeployment,
	FineTuningJob,
	FineTuningJobEvent,
	FineTuningModelDefinition,
	FineTuningProviderId,
	StartFineTuningJobRequest,
} from "@assistant/schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow, returnFetchedData } from "./fetch-wrapper";

type TrainingRequestInit = Omit<RequestInit, "headers"> & {
	headers?: Record<string, string>;
};

async function trainingRequest<T>(path: string, init: TrainingRequestInit = {}): Promise<T> {
	const headers = await apiService.getHeaders();
	const response = await fetchApiOrThrow(`/training${path}`, {
		...init,
		headers: {
			...headers,
			...init.headers,
		},
	});

	return returnFetchedData<T>(response);
}

export async function fetchFineTuningModels(): Promise<FineTuningModelDefinition[]> {
	const data = await trainingRequest<{ models: FineTuningModelDefinition[] }>("/models");
	return data.models;
}

export async function fetchFineTuningJobs(): Promise<FineTuningJob[]> {
	const data = await trainingRequest<{ jobs: FineTuningJob[] }>("/jobs");
	return data.jobs;
}

export async function startFineTuningJob(
	request: StartFineTuningJobRequest,
): Promise<FineTuningJob> {
	return trainingRequest<FineTuningJob>("/jobs", {
		method: "POST",
		body: JSON.stringify(request),
	});
}

export async function fetchFineTuningJobEvents(
	provider: FineTuningProviderId,
	jobName: string,
): Promise<FineTuningJobEvent[]> {
	const data = await trainingRequest<{ events: FineTuningJobEvent[] }>(
		`/jobs/${encodeURIComponent(provider)}/${encodeURIComponent(jobName)}/events`,
	);
	return data.events;
}

export async function fetchFineTunedDeployments(): Promise<FineTunedDeployment[]> {
	const data = await trainingRequest<{ deployments: FineTunedDeployment[] }>("/deployments");
	return data.deployments;
}

export async function deployFineTunedModel(
	request: DeployFineTunedModelRequest,
): Promise<FineTunedDeployment> {
	return trainingRequest<FineTunedDeployment>("/deployments", {
		method: "POST",
		body: JSON.stringify(request),
	});
}
