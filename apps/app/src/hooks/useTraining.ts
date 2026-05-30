import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	DeployFineTunedModelRequest,
	FineTuningProviderId,
	StartFineTuningJobRequest,
} from "@assistant/schemas";

import {
	deployFineTunedModel,
	fetchFineTunedDeployments,
	fetchFineTuningJobEvents,
	fetchFineTuningJobs,
	fetchFineTuningModels,
	startFineTuningJob,
} from "~/lib/api/training";

export const TRAINING_QUERY_KEYS = {
	models: ["training", "models"],
	jobs: ["training", "jobs"],
	deployments: ["training", "deployments"],
	events: (provider?: FineTuningProviderId, jobName?: string) => [
		"training",
		"events",
		provider,
		jobName,
	],
};

const ACTIVE_JOB_STATUSES = new Set(["starting", "inprogress", "in progress", "stopping"]);

export function useFineTuningModels() {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.models,
		queryFn: fetchFineTuningModels,
		staleTime: 1000 * 60 * 5,
	});
}

export function useFineTuningJobs() {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.jobs,
		queryFn: fetchFineTuningJobs,
		refetchInterval: (query) => {
			const jobs = query.state.data;
			if (!jobs?.some((job) => ACTIVE_JOB_STATUSES.has(job.status.toLowerCase()))) {
				return false;
			}

			return 10000;
		},
	});
}

export function useFineTuningJobEvents(provider?: FineTuningProviderId, jobName?: string) {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.events(provider, jobName),
		queryFn: () => {
			if (!provider || !jobName) return [];

			return fetchFineTuningJobEvents(provider, jobName);
		},
		enabled: Boolean(provider && jobName),
		refetchInterval: provider && jobName ? 10000 : false,
	});
}

export function useFineTunedDeployments() {
	return useQuery({
		queryKey: TRAINING_QUERY_KEYS.deployments,
		queryFn: fetchFineTunedDeployments,
	});
}

export function useStartFineTuningJob() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request: StartFineTuningJobRequest) => startFineTuningJob(request),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: TRAINING_QUERY_KEYS.jobs });
		},
	});
}

export function useDeployFineTunedModel() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request: DeployFineTunedModelRequest) => deployFineTunedModel(request),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: TRAINING_QUERY_KEYS.deployments });
		},
	});
}
