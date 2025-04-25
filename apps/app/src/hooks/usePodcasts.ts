import { useMutation, useQuery } from "@tanstack/react-query";

import {
  fetchPodcast,
  fetchPodcasts,
  processPodcast,
  uploadPodcast,
} from "~/lib/api/dynamic-apps";
import type { Podcast } from "~/types/podcast";

export const useFetchPodcasts = () => {
  return useQuery<Podcast[], Error>({
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
