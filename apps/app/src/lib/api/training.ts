import type {
	DeployTrainingModelRequest,
	TrainingDeployment,
	TrainingDeploymentDeleteResponse,
	TrainingJob,
	TrainingJobEvent,
	TrainingModelDefinition,
	TrainingProviderId,
	StartTrainingJobRequest,
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

export async function fetchTrainingModels(): Promise<TrainingModelDefinition[]> {
	const data = await trainingRequest<{ models: TrainingModelDefinition[] }>("/models");
	return data.models;
}

export async function fetchTrainingJobs(): Promise<TrainingJob[]> {
	const data = await trainingRequest<{ jobs: TrainingJob[] }>("/jobs");
	return data.jobs;
}

export async function startTrainingJob(request: StartTrainingJobRequest): Promise<TrainingJob> {
	return trainingRequest<TrainingJob>("/jobs", {
		method: "POST",
		body: JSON.stringify(request),
	});
}

export async function fetchTrainingJobEvents(
	provider: TrainingProviderId,
	jobName: string,
): Promise<TrainingJobEvent[]> {
	const data = await trainingRequest<{ events: TrainingJobEvent[] }>(
		`/jobs/${encodeURIComponent(provider)}/${encodeURIComponent(jobName)}/events`,
	);
	return data.events;
}

export async function fetchTrainingDeployments(): Promise<TrainingDeployment[]> {
	const data = await trainingRequest<{ deployments: TrainingDeployment[] }>("/deployments");
	return data.deployments;
}

export async function deployTrainingModel(
	request: DeployTrainingModelRequest,
): Promise<TrainingDeployment> {
	return trainingRequest<TrainingDeployment>("/deployments", {
		method: "POST",
		body: JSON.stringify(request),
	});
}

export async function deleteTrainingDeployment(
	provider: TrainingProviderId,
	endpointName: string,
): Promise<TrainingDeploymentDeleteResponse> {
	return trainingRequest<TrainingDeploymentDeleteResponse>(
		`/deployments/${encodeURIComponent(provider)}/${encodeURIComponent(endpointName)}`,
		{
			method: "DELETE",
		},
	);
}
