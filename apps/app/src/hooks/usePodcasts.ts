import { useMutation, useQuery } from "@tanstack/react-query";
import type { Podcast, PodcastListItem } from "@assistant/schemas";

import { fetchPodcast, fetchPodcasts, processPodcast, uploadPodcast } from "~/lib/api/dynamic-apps";

export const useFetchPodcasts = () => {
	return useQuery<PodcastListItem[], Error>({
		queryKey: ["podcasts"],
		queryFn: fetchPodcasts,
	});
};

export const useFetchPodcast = (id: string) => {
	return useQuery<Podcast, Error>({
		queryKey: ["podcast", id],
		queryFn: () => fetchPodcast(id),
		enabled: !!id,
	});
};

export const useUploadPodcast = () => {
	return useMutation({
		mutationFn: uploadPodcast,
	});
};

export const useProcessPodcast = () => {
	return useMutation({
		mutationFn: processPodcast,
	});
};
