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
  ListNotesResponse,
  ListRecordingsResponse,
  Note,
  NoteCreateRequest,
  NoteDetailResponse,
  NoteFormatResponse,
  NoteUpdateRequest,
  Recording,
  RecordingDetailResponse,
  RecordingListItem,
} from "@ngriffin_uk/polychat-schemas";
import type {
  ProcessRecordingParams,
  UploadRecordingParams,
  UploadResponse,
} from "@ngriffin_uk/polychat-schemas/experiences";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { withProjectScope } from "./project-scope.js";

export const fetchRecordings = async (projectId?: string): Promise<RecordingListItem[]> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching recordings:", error);
  }

  const response = await fetchApi(withProjectScope("/apps/recordings", projectId), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recordings: ${response.statusText}`);
  }

  const data = await returnFetchedData<ListRecordingsResponse>(response);

  return data.recordings || [];
};

export const fetchRecording = async (id: string, projectId?: string): Promise<Recording> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching recording:", error);
  }

  const response = await fetchApi(withProjectScope(`/apps/recordings/${id}`, projectId), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recording: ${response.statusText}`);
  }

  const data = await returnFetchedData<RecordingDetailResponse>(response);

  return data.recording;
};

export const uploadRecording = async (
  params: UploadRecordingParams,
  projectId?: string,
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
    console.error("Error uploading recording:", error);
  }

  const filteredHeaders = { ...headers };

  const response = await fetchApi(withProjectScope("/apps/recordings/upload", projectId), {
    method: "POST",
    body: formData,
    headers: filteredHeaders,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload recording: ${response.statusText}`);
  }

  return await returnFetchedData<UploadResponse>(response);
};

export const processRecording = async (params: ProcessRecordingParams, projectId?: string) => {
  const endpoint = withProjectScope(`/apps/recordings/${params.action}`, projectId);
  const body: Record<string, any> = {
    recordingId: params.recordingId,
  };

  if (params.action === "transcribe") {
    body.numberOfSpeakers = params.numberOfSpeakers || 2;
    body.prompt =
      params.prompt ||
      `Transcribe this recording with the following speakers: ${params.speakers ? JSON.stringify(params.speakers) : "Person 1, 2, etc"}`;
  } else if (params.action === "summarise") {
    body.speakers = params.speakers || {};
  } else if (params.action === "generate-image" && params.prompt) {
    body.prompt = params.prompt;
  }

  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error processing recording:", error);
  }

  const response = await fetchApi(endpoint, {
    method: "POST",
    body,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to process recording: ${response.statusText}`);
  }

  return await returnFetchedData<Record<string, any>>(response);
};

export const fetchArticles = async (projectId?: string): Promise<ArticlesResponse> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching articles:", error);
  }

  const response = await fetchApi(withProjectScope("/apps/articles", projectId), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to fetch articles: ${response.statusText}`);
  }

  return await returnFetchedData<ArticlesResponse>(response);
};

export const fetchArticle = async (id: string, projectId?: string): Promise<ArticleResponse> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching article:", error);
  }

  const response = await fetchApi(withProjectScope(`/apps/articles/${id}`, projectId), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to fetch article report: ${response.statusText}`);
  }

  return await returnFetchedData<ArticleResponse>(response);
};

export const analyseArticle = async (
  params: AnalyseArticleParams,
  projectId?: string,
): Promise<AnalyseArticleResponse> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error analysing article:", error);
  }

  const response = await fetchApi(withProjectScope("/apps/articles/analyse", projectId), {
    method: "POST",
    body: params,
    headers,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to analyse article: ${response.statusText}`);
  }

  return await returnFetchedData<AnalyseArticleResponse>(response);
};

export const summariseArticle = async (
  params: SummariseArticleParams,
  projectId?: string,
): Promise<SummariseArticleResponse> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error summarising article:", error);
  }

  const response = await fetchApi(withProjectScope("/apps/articles/summarise", projectId), {
    method: "POST",
    body: params,
    headers,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to summarise article: ${response.statusText}`);
  }

  return await returnFetchedData<SummariseArticleResponse>(response);
};

export const generateReport = async (
  params: GenerateReportParams,
  projectId?: string,
): Promise<GenerateReportResponse> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error generating report:", error);
  }

  const response = await fetchApi(withProjectScope("/apps/articles/generate-report", projectId), {
    method: "POST",
    body: params,
    headers,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to generate report: ${response.statusText}`);
  }

  return await returnFetchedData<GenerateReportResponse>(response);
};

export const fetchSourceArticlesByIds = async (
  ids: string[],
  projectId?: string,
): Promise<FetchMultipleArticlesResponse> => {
  if (!ids.length) {
    return { articles: [] };
  }

  const queryString = ids.map((id) => `ids[]=${encodeURIComponent(id)}`).join("&");
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching source articles:", error);
  }

  const response = await fetchApi(
    withProjectScope(`/apps/articles/sources?${queryString}`, projectId),
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(
      errorData?.message || `Failed to fetch source articles: ${response.statusText}`,
    );
  }

  return await returnFetchedData<FetchMultipleArticlesResponse>(response);
};

export const fetchNotes = async (projectId?: string): Promise<Note[]> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error fetching notes:", e);
  }

  const response = await fetchApi(withProjectScope("/apps/notes", projectId), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }

  const data = await returnFetchedData<ListNotesResponse>(response);

  return data.notes;
};

export const fetchNote = async (id: string, projectId?: string): Promise<Note> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error fetching note:", e);
  }

  const response = await fetchApi(withProjectScope(`/apps/notes/${id}`, projectId), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to fetch note: ${response.statusText}`);
  }

  const data = await returnFetchedData<NoteDetailResponse>(response);

  return data.note;
};

export const createNote = async (params: NoteCreateRequest, projectId?: string): Promise<Note> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error creating note:", e);
  }

  const response = await fetchApi(withProjectScope("/apps/notes", projectId), {
    method: "POST",
    headers,
    body: params,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to create note: ${response.statusText}`);
  }

  const data = await returnFetchedData<NoteDetailResponse>(response);

  return data.note;
};

export const updateNote = async (
  params: NoteUpdateRequest & { id: string },
  projectId?: string,
): Promise<Note> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error updating note:", e);
  }

  const { id, ...body } = params;

  const response = await fetchApi(withProjectScope(`/apps/notes/${id}`, projectId), {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to update note: ${response.statusText}`);
  }

  const data = await returnFetchedData<NoteDetailResponse>(response);

  return data.note;
};

export const deleteNote = async (id: string, projectId?: string): Promise<void> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error deleting note:", e);
  }

  const response = await fetchApi(withProjectScope(`/apps/notes/${id}`, projectId), {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to delete note: ${response.statusText}`);
  }
};

export const formatNoteAPI = async (
  id: string,
  prompt?: string,
  projectId?: string,
): Promise<string> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for note formatting:", e);
  }

  const response = await fetchApi(withProjectScope(`/apps/notes/${id}/format`, projectId), {
    method: "POST",
    headers,
    body: { prompt },
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to format note: ${response.statusText}`);
  }

  const data = await returnFetchedData<NoteFormatResponse>(response);

  return data.content;
};

export const extractArticleContent = async (
  params: ExtractArticleContentParams,
  projectId?: string,
): Promise<ExtractArticleContentResponse> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error extracting article content:", e);
  }

  const response = await fetchApi(withProjectScope("/apps/articles/extract-content", projectId), {
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
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(
      errorData?.message || `Failed to extract article content: ${response.statusText}`,
    );
  }

  return await returnFetchedData<ExtractArticleContentResponse>(response);
};

export const prepareSessionForRerun = async (itemId: string, projectId?: string): Promise<void> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error preparing session for rerun:", e);
  }

  const response = await fetchApi(
    withProjectScope(`/apps/articles/prepare-rerun/${itemId}`, projectId),
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(
      errorData?.message || `Failed to prepare session for rerun: ${response.statusText}`,
    );
  }
};

export const generateNotesFromMedia = async (
  params: {
    url: string;
    outputs: (
      | "concise_summary"
      | "detailed_outline"
      | "key_takeaways"
      | "action_items"
      | "meeting_minutes"
      | "qa_extraction"
      | "scene_analysis"
      | "visual_insights"
      | "smart_timestamps"
    )[];
    noteType:
      | "general"
      | "meeting"
      | "training"
      | "lecture"
      | "interview"
      | "recording"
      | "webinar"
      | "tutorial"
      | "video_content"
      | "educational_video"
      | "documentary"
      | "other";
    extraPrompt?: string;
    timestamps?: boolean;
    useVideoAnalysis?: boolean;
    enableVideoSearch?: boolean;
  },
  projectId?: string,
): Promise<{ content: string }> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for media generation:", e);
  }

  const response = await fetchApi(withProjectScope(`/apps/notes/generate-from-media`, projectId), {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await returnFetchedData<{ message?: string }>(response);

    throw new Error(errorData?.message || `Failed to generate notes: ${response.statusText}`);
  }

  return await returnFetchedData<{ content: string }>(response);
};
