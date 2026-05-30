import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	DeployTrainingModelRequest,
	TrainingProviderId,
	StartTrainingJobRequest,
} from "@assistant/schemas";

import {
	deleteTrainingDeployment,
	deployTrainingModel,
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
};

const ACTIVE_JOB_STATUSES = new Set(["starting", "inprogress", "in progress", "stopping"]);

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

export function useTrainingJobEvents(provider?: TrainingProviderId, jobName?: string) {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.events(provider, jobName),
		queryFn: () => {
			if (!provider || !jobName) return [];

			return fetchTrainingJobEvents(provider, jobName);
		},
		enabled: Boolean(provider && jobName),
		refetchInterval: provider && jobName ? 10000 : false,
	});
}

export function useTrainingDeployments() {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.deployments,
		queryFn: fetchTrainingDeployments,
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
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: TRAINING_QUERY_KEYS.deployments });
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
