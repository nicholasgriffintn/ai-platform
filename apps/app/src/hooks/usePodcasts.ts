import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchApi } from "~/lib/api/fetch-wrapper";
import type { Podcast } from "~/types/podcast";

interface PodcastsResponse {
  podcasts: Podcast[];
}

interface PodcastResponse {
  podcast: Podcast;
}

interface UploadPodcastParams {
  title: string;
  description?: string;
  audio?: File;
  audioUrl?: string;
}

interface UploadResponse {
  response: {
    completion_id: string;
    status: string;
    content: string;
    data: {
      title: string;
      description?: string;
      audioUrl: string;
      imageKey?: string;
      signedUrl?: string;
      status: string;
      createdAt: string;
    };
  };
}

interface ProcessPodcastParams {
  podcastId: string;
  action: "transcribe" | "summarise" | "generate-image";
  prompt?: string;
  numberOfSpeakers?: number;
  speakers?: Record<string, string>;
}

const fetchPodcasts = async (): Promise<Podcast[]> => {
  const response = await fetchApi("/apps/podcasts", {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch podcasts: ${response.statusText}`);
  }

  const data = (await response.json()) as PodcastsResponse;
  return data.podcasts || [];
};

const fetchPodcast = async (id: string): Promise<Podcast> => {
  const response = await fetchApi(`/apps/podcasts/${id}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch podcast: ${response.statusText}`);
  }

  const data = (await response.json()) as PodcastResponse;
  return data.podcast;
};

const uploadPodcast = async (
  params: UploadPodcastParams,
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("title", params.title);
  if (params.description) {
    formData.append("description", params.description);
  }
  if (params.audio) {
    formData.append("audio", params.audio);
  }
  if (params.audioUrl) {
    formData.append("audioUrl", params.audioUrl);
  }

  const response = await fetchApi("/apps/podcasts/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload podcast: ${response.statusText}`);
  }

  return response.json() as Promise<UploadResponse>;
};

const processPodcast = async (params: ProcessPodcastParams) => {
  const endpoint = `/apps/podcasts/${params.action}`;
  const body: Record<string, any> = {
    podcastId: params.podcastId,
  };

  if (params.action === "transcribe") {
    body.numberOfSpeakers = params.numberOfSpeakers || 2;
    body.prompt =
      params.prompt ||
      `Transcribe this podcast with the following speakers: ${params.speakers ? JSON.stringify(params.speakers) : "Person 1, 2, etc"}`;
  } else if (params.action === "summarise") {
    body.speakers = params.speakers || {};
  } else if (params.action === "generate-image" && params.prompt) {
    body.prompt = params.prompt;
  }

  const response = await fetchApi(endpoint, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to process podcast: ${response.statusText}`);
  }

  return response.json();
};

export const useFetchPodcasts = () => {
  return useQuery({
    queryKey: ["podcasts"],
    queryFn: fetchPodcasts,
  });
};

export const useFetchPodcast = (id: string) => {
  return useQuery({
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
