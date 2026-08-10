import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Podcast, PodcastListItem } from "@assistant/schemas";

import { fetchPodcast, fetchPodcasts, processPodcast, uploadPodcast } from "~/lib/api/dynamic-apps";

export const useFetchPodcasts = (projectId?: string, options?: { enabled?: boolean }) => {
	return useQuery<PodcastListItem[], Error>({
		queryKey: ["podcasts", projectId],
		queryFn: () => fetchPodcasts(projectId),
		enabled: options?.enabled ?? true,
	});
};

export const useFetchPodcast = (id: string, projectId?: string) => {
	return useQuery<Podcast, Error>({
		queryKey: ["podcast", projectId, id],
		queryFn: () => fetchPodcast(id, projectId),
		enabled: !!id,
	});
};

export const useUploadPodcast = (projectId?: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (params: Parameters<typeof uploadPodcast>[0]) => uploadPodcast(params, projectId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["podcasts", projectId] });
		},
	});
};

export const useProcessPodcast = (projectId?: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (params: Parameters<typeof processPodcast>[0]) => processPodcast(params, projectId),
		onSuccess: (_, params) => {
			queryClient.invalidateQueries({ queryKey: ["podcast", projectId, params.podcastId] });
			queryClient.invalidateQueries({ queryKey: ["podcasts", projectId] });
		},
	});
};
