import type { Podcast, PodcastListItem } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchPodcast, fetchPodcasts, processPodcast, uploadPodcast } from "~/lib/api/apps";

export const useFetchPodcasts = (projectId?: string, options?: { enabled?: boolean }) => {
  return useQuery<PodcastListItem[]>({
    queryKey: ["podcasts", projectId],
    queryFn: () => fetchPodcasts(projectId),
    enabled: options?.enabled ?? true,
  });
};

export const useFetchPodcast = (id: string, projectId?: string) => {
  return useQuery<Podcast>({
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
      void queryClient.invalidateQueries({ queryKey: ["podcasts", projectId] });
    },
  });
};

export const useProcessPodcast = (projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof processPodcast>[0]) => processPodcast(params, projectId),
    onSuccess: (_, params) => {
      void queryClient.invalidateQueries({ queryKey: ["podcast", projectId, params.podcastId] });
      void queryClient.invalidateQueries({ queryKey: ["podcasts", projectId] });
    },
  });
};
