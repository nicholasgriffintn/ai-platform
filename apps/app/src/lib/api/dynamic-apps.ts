import type { AppSchema } from "~/types/apps";
import type { AppListItem } from "~/types/apps";
import type {
  AnalyseArticleParams,
  AnalyseArticleResponse,
  ArticleResponse,
  ArticlesResponse,
  FetchMultipleArticlesResponse,
  GenerateReportParams,
  GenerateReportResponse,
  SummariseArticleParams,
  SummariseArticleResponse,
} from "~/types/article";
import type {
  Podcast,
  PodcastResponse,
  PodcastsResponse,
  ProcessPodcastParams,
  UploadPodcastParams,
  UploadResponse,
} from "~/types/podcast";
import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

export const fetchDynamicApps = async (): Promise<AppListItem[]> => {
  try {
    let headers = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error fetching dynamic apps:", error);
    }

    const response = await fetchApi("/dynamic-apps", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dynamic apps: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching dynamic apps:", error);
    throw error;
  }
};

export const fetchDynamicAppById = async (id: string): Promise<AppSchema> => {
  try {
    let headers = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error fetching dynamic app:", error);
    }

    const response = await fetchApi(`/dynamic-apps/${id}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dynamic app: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching dynamic app ${id}:`, error);
    throw error;
  }
};

export const executeDynamicApp = async (
  id: string,
  formData: Record<string, any>,
): Promise<Record<string, any>> => {
  try {
    let headers = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error executing dynamic app:", error);
    }

    const response = await fetchApi(`/dynamic-apps/${id}/execute`, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to execute dynamic app: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error executing dynamic app ${id}:`, error);
    throw error;
  }
};

export const fetchPodcasts = async (): Promise<Podcast[]> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching podcasts:", error);
  }

  const response = await fetchApi("/apps/podcasts", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch podcasts: ${response.statusText}`);
  }

  const data = (await response.json()) as PodcastsResponse;
  return data.podcasts || [];
};

export const fetchPodcast = async (id: string): Promise<Podcast> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching podcast:", error);
  }

  const response = await fetchApi(`/apps/podcasts/${id}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch podcast: ${response.statusText}`);
  }

  const data = (await response.json()) as PodcastResponse;
  return data.podcast;
};

export const uploadPodcast = async (
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

  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error uploading podcast:", error);
  }

  const filteredHeaders = { ...headers };

  const response = await fetchApi("/apps/podcasts/upload", {
    method: "POST",
    body: formData,
    headers: filteredHeaders,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload podcast: ${response.statusText}`);
  }

  return response.json() as Promise<UploadResponse>;
};

export const processPodcast = async (params: ProcessPodcastParams) => {
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

  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error processing podcast:", error);
  }

  const response = await fetchApi(endpoint, {
    method: "POST",
    body,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to process podcast: ${response.statusText}`);
  }

  return response.json();
};

export const fetchArticles = async (): Promise<ArticlesResponse> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching articles:", error);
  }

  const response = await fetchApi("/apps/articles", {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message || `Failed to fetch articles: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ArticlesResponse>;
};

export const fetchArticle = async (id: string): Promise<ArticleResponse> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching article:", error);
  }

  const response = await fetchApi(`/apps/articles/${id}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message ||
        `Failed to fetch article report: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ArticleResponse>;
};

export const analyseArticle = async (
  params: AnalyseArticleParams,
): Promise<AnalyseArticleResponse> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error analysing article:", error);
  }

  const response = await fetchApi("/apps/articles/analyse", {
    method: "POST",
    body: params,
    headers,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message || `Failed to analyse article: ${response.statusText}`,
    );
  }
  return response.json() as Promise<AnalyseArticleResponse>;
};

export const summariseArticle = async (
  params: SummariseArticleParams,
): Promise<SummariseArticleResponse> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error summarising article:", error);
  }

  const response = await fetchApi("/apps/articles/summarise", {
    method: "POST",
    body: params,
    headers,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message ||
        `Failed to summarise article: ${response.statusText}`,
    );
  }
  return response.json() as Promise<SummariseArticleResponse>;
};

export const generateReport = async (
  params: GenerateReportParams,
): Promise<GenerateReportResponse> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error generating report:", error);
  }

  const response = await fetchApi("/apps/articles/generate-report", {
    method: "POST",
    body: params,
    headers,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message || `Failed to generate report: ${response.statusText}`,
    );
  }
  return response.json() as Promise<GenerateReportResponse>;
};

export const fetchSourceArticlesByIds = async (
  ids: string[],
): Promise<FetchMultipleArticlesResponse> => {
  if (!ids.length) return { status: "success", articles: [] };

  const queryString = ids
    .map((id) => `ids[]=${encodeURIComponent(id)}`)
    .join("&");
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching source articles:", error);
  }

  const response = await fetchApi(`/apps/articles/sources?${queryString}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message ||
        `Failed to fetch source articles: ${response.statusText}`,
    );
  }
  return response.json() as Promise<FetchMultipleArticlesResponse>;
};
