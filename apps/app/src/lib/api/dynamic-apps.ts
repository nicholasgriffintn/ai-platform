import type { AppDataItem } from "~/components/Apps/ContentRenderers";
import type { AppListItem, AppSchema } from "~/types/apps";
import type {
  AnalyseArticleParams,
  AnalyseArticleResponse,
  ArticleResponse,
  ArticlesResponse,
  ExtractArticleContentParams,
  ExtractArticleContentResponse,
  FetchMultipleArticlesResponse,
  GenerateReportParams,
  GenerateReportResponse,
  SummariseArticleParams,
  SummariseArticleResponse,
} from "~/types/article";
import type { Note } from "~/types/note";
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

export const fetchDynamicAppResponseById = async (
  responseId: string,
): Promise<AppDataItem> => {
  try {
    let headers: Record<string, string> = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error fetching dynamic app response:", error);
    }

    const response = await fetchApi(`/dynamic-apps/responses/${responseId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch dynamic app response: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { response: AppDataItem };
    return data.response;
  } catch (error) {
    console.error(`Error fetching dynamic app response ${responseId}:`, error);
    throw error;
  }
};

export const fetchDynamicAppResponses = async (
  appId?: string,
): Promise<AppDataItem[]> => {
  try {
    let headers: Record<string, string> = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error fetching dynamic app responses:", error);
    }

    const url = appId
      ? `/dynamic-apps/responses?appId=${encodeURIComponent(appId)}`
      : "/dynamic-apps/responses";

    const response = await fetchApi(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch dynamic app responses: ${response.statusText}`,
      );
    }

    return (await response.json()) as AppDataItem[];
  } catch (error) {
    console.error("Error fetching dynamic app responses:", error);
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

export const fetchNotes = async (): Promise<Note[]> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error fetching notes:", e);
  }

  const response = await fetchApi("/apps/notes", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }

  const data = (await response.json()) as { notes: Note[] };
  return data.notes;
};

export const fetchNote = async (id: string): Promise<Note> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error fetching note:", e);
  }

  const response = await fetchApi(`/apps/notes/${id}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message || `Failed to fetch note: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { note: Note };
  return data.note;
};

export const createNote = async (params: {
  title: string;
  content: string;
  metadata?: any;
  attachments?: any[];
}): Promise<Note> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error creating note:", e);
  }

  const response = await fetchApi("/apps/notes", {
    method: "POST",
    headers,
    body: params,
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message || `Failed to create note: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { note: Note };
  return data.note;
};

export const updateNote = async (params: {
  id: string;
  title: string;
  content: string;
  metadata?: any;
  attachments?: any[];
}): Promise<Note> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error updating note:", e);
  }

  const { id, ...body } = params;

  const response = await fetchApi(`/apps/notes/${id}`, {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message || `Failed to update note: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { note: Note };
  return data.note;
};

export const deleteNote = async (id: string): Promise<void> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error deleting note:", e);
  }

  const response = await fetchApi(`/apps/notes/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message || `Failed to delete note: ${response.statusText}`,
    );
  }
};

export const formatNoteAPI = async (
  id: string,
  prompt?: string,
): Promise<string> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for note formatting:", e);
  }

  const response = await fetchApi(`/apps/notes/${id}/format`, {
    method: "POST",
    headers,
    body: { prompt },
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message || `Failed to format note: ${response.statusText}`,
    );
  }

  const data = (await response.json().catch(() => ({}))) as { content: string };
  return data.content;
};

export const extractArticleContent = async (
  params: ExtractArticleContentParams,
): Promise<ExtractArticleContentResponse> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error extracting article content:", e);
  }

  const response = await fetchApi("/apps/articles/extract-content", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      urls: params.urls,
      extract_depth: params.extractDepth || "basic",
      include_images: params.includeImages || false,
    }),
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message ||
        `Failed to extract article content: ${response.statusText}`,
    );
  }

  return response.json() as Promise<ExtractArticleContentResponse>;
};

export const prepareSessionForRerun = async (itemId: string): Promise<void> => {
  let headers = {};
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error preparing session for rerun:", e);
  }

  const response = await fetchApi(`/apps/articles/prepare-rerun/${itemId}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message ||
        `Failed to prepare session for rerun: ${response.statusText}`,
    );
  }
};
