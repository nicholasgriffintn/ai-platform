import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	DeployTrainingModelRequest,
	TrainingProviderId,
	StartTrainingJobRequest,
} from "@assistant/schemas";

import {
	deleteTrainingDeployment,
	deployTrainingModel,
	fetchTrainingDeploymentEvents,
	fetchTrainingDeployments,
	fetchTrainingJobEvents,
	fetchTrainingJobs,
	fetchTrainingModels,
	startTrainingJob,
} from "~/lib/api/training";

export const TRAINING_QUERY_KEYS = {
	models: ["training", "models"],
	jobs: ["training", "jobs"],
	deployments: ["training", "deployments"],
	events: (provider?: TrainingProviderId, jobName?: string) => [
		"training",
		"events",
		provider,
		jobName,
	],
	deploymentEvents: (provider?: TrainingProviderId, endpointName?: string) => [
		"training",
		"deployment-events",
		provider,
		endpointName,
	],
};

const ACTIVE_JOB_STATUSES = new Set(["starting", "inprogress", "in progress", "stopping"]);
const ACTIVE_DEPLOYMENT_STATUSES = new Set(["creating", "updating"]);

interface TrainingEventsOptions {
	enabled?: boolean;
	refetchInterval?: number | false;
}

export function useTrainingModels() {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.models,
		queryFn: fetchTrainingModels,
		staleTime: 1000 * 60 * 5,
	});
}

export function useTrainingJobs() {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.jobs,
		queryFn: fetchTrainingJobs,
		refetchInterval: (query) => {
			const jobs = query.state.data;
			if (!jobs?.some((job) => ACTIVE_JOB_STATUSES.has(job.status.toLowerCase()))) {
				return false;
			}

			return 10000;
		},
	});
}

export function useTrainingJobEvents(
	provider?: TrainingProviderId,
	jobName?: string,
	options: TrainingEventsOptions = {},
) {
	const enabled = options.enabled ?? true;
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.events(provider, jobName),
		queryFn: () => {
			if (!provider || !jobName) return [];

			return fetchTrainingJobEvents(provider, jobName);
		},
		enabled: Boolean(enabled && provider && jobName),
		refetchInterval: enabled && provider && jobName ? (options.refetchInterval ?? false) : false,
	});
}

export function useTrainingDeploymentEvents(
	provider?: TrainingProviderId,
	endpointName?: string,
	options: TrainingEventsOptions = {},
) {
	const enabled = options.enabled ?? true;
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.deploymentEvents(provider, endpointName),
		queryFn: () => {
			if (!provider || !endpointName) return [];

			return fetchTrainingDeploymentEvents(provider, endpointName);
		},
		enabled: Boolean(enabled && provider && endpointName),
		refetchInterval:
			enabled && provider && endpointName ? (options.refetchInterval ?? false) : false,
	});
}

export function useTrainingDeployments() {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.deployments,
		queryFn: fetchTrainingDeployments,
		refetchInterval: (query) => {
			const deployments = query.state.data;
			if (
				!deployments?.some((deployment) =>
					ACTIVE_DEPLOYMENT_STATUSES.has(deployment.status.toLowerCase()),
				)
			) {
				return false;
			}

			return 10000;
		},
	});
}

export function useStartTrainingJob() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request: StartTrainingJobRequest) => startTrainingJob(request),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: TRAINING_QUERY_KEYS.jobs });
		},
	});
}

export function useDeployTrainingModel() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request: DeployTrainingModelRequest) => deployTrainingModel(request),
		onSuccess: (deployment) => {
			queryClient.invalidateQueries({ queryKey: TRAINING_QUERY_KEYS.deployments });
			queryClient.invalidateQueries({
				queryKey: TRAINING_QUERY_KEYS.deploymentEvents(
					deployment.provider,
					deployment.endpointName,
				),
			});
		},
	});
}

export function useDeleteTrainingDeployment() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			provider,
			endpointName,
		}: {
			provider: TrainingProviderId;
			endpointName: string;
		}) => deleteTrainingDeployment(provider, endpointName),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: TRAINING_QUERY_KEYS.deployments });
		},
	});
}
