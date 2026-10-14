import type {
  AnalyseArticleParams,
  ArticleResponse,
  ArticleSessionSummary,
  ArticlesResponse,
  ExtractArticleContentParams,
  ExtractArticleContentResponse,
  FetchMultipleArticlesResponse,
  GenerateReportParams,
  Job,
  SummariseArticleParams,
  Note,
  NoteSummary,
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

import { startJobOfKind } from "./jobs.js";
import { withProjectScope } from "./project-scope.js";
import { requestJson, resource } from "./resource.js";

const EXPERIENCES = "/experiences";

function experiencePath(path: string, projectId?: string): string {
  return withProjectScope(`${EXPERIENCES}${path}`, projectId);
}

function listExperience<TItem>(path: string, projectId?: string, query?: { q?: string }) {
  return resource<TItem>(`${EXPERIENCES}${path}`).listAll({ project_id: projectId, ...query });
}

export const fetchRecordings = (projectId?: string): Promise<RecordingListItem[]> =>
  listExperience<RecordingListItem>("/recordings", projectId);

export const fetchRecording = async (id: string, projectId?: string): Promise<Recording> =>
  (
    await requestJson<RecordingDetailResponse>(
      experiencePath(`/recordings/${encodeURIComponent(id)}`, projectId),
      "GET",
    )
  ).recording;

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

  return requestJson<UploadResponse>(experiencePath("/recordings", projectId), "POST", formData);
};

export const processRecording = (
  params: ProcessRecordingParams,
  projectId?: string,
): Promise<Job> => {
  if (params.action === "transcribe") {
    return startJobOfKind({
      kind: "recording_transcription",
      project_id: projectId,
      input: {
        recordingId: params.recordingId,
        numberOfSpeakers: params.numberOfSpeakers || 2,
        prompt:
          params.prompt ||
          `Transcribe this recording with the following speakers: ${params.speakers ? JSON.stringify(params.speakers) : "Person 1, 2, etc"}`,
      },
    });
  }

  if (params.action === "summarise") {
    return startJobOfKind({
      kind: "recording_summary",
      project_id: projectId,
      input: { recordingId: params.recordingId, speakers: params.speakers || {} },
    });
  }

  return startJobOfKind({
    kind: "recording_image",
    project_id: projectId,
    input: { recordingId: params.recordingId, prompt: params.prompt },
  });
};

export const fetchArticles = async (projectId?: string): Promise<ArticlesResponse> => ({
  articles: await listExperience<ArticleSessionSummary>("/articles", projectId),
});

export const fetchArticle = async (id: string): Promise<ArticleResponse> => ({
  article: await requestJson<ArticleResponse["article"]>(
    `/outputs/${encodeURIComponent(id)}`,
    "GET",
  ),
});

export const analyseArticle = (params: AnalyseArticleParams, projectId?: string) =>
  startJobOfKind({ kind: "article_analysis", project_id: projectId, input: params });

export const summariseArticle = (params: SummariseArticleParams, projectId?: string) =>
  startJobOfKind({ kind: "article_summary", project_id: projectId, input: params });

export const generateReport = (params: GenerateReportParams, projectId?: string) =>
  startJobOfKind({ kind: "article_report", project_id: projectId, input: params });

export const fetchSourceArticlesByIds = async (
  ids: string[],
  projectId?: string,
): Promise<FetchMultipleArticlesResponse> => {
  if (!ids.length) {
    return { articles: [] };
  }

  const query = ids.map((id) => `ids=${encodeURIComponent(id)}`).join("&");

  return requestJson<FetchMultipleArticlesResponse>(
    experiencePath(`/articles/sources?${query}`, projectId),
    "GET",
  );
};

export const fetchNotes = (projectId?: string, query?: string): Promise<NoteSummary[]> =>
  listExperience<NoteSummary>("/notes", projectId, { q: query?.trim() || undefined });

export const fetchNote = async (id: string, projectId?: string): Promise<Note> =>
  (
    await requestJson<NoteDetailResponse>(
      experiencePath(`/notes/${encodeURIComponent(id)}`, projectId),
      "GET",
    )
  ).note;

export const createNote = async (params: NoteCreateRequest, projectId?: string): Promise<Note> =>
  (await requestJson<NoteDetailResponse>(experiencePath("/notes", projectId), "POST", params)).note;

export const updateNote = async (
  params: NoteUpdateRequest & { id: string },
  projectId?: string,
): Promise<Note> => {
  const { id, ...body } = params;

  return (
    await requestJson<NoteDetailResponse>(
      experiencePath(`/notes/${encodeURIComponent(id)}`, projectId),
      "PATCH",
      body,
    )
  ).note;
};

export const deleteNote = async (id: string, projectId?: string): Promise<void> => {
  await requestJson<unknown>(
    experiencePath(`/notes/${encodeURIComponent(id)}`, projectId),
    "DELETE",
  );
};

export const formatNoteAPI = async (
  id: string,
  prompt?: string,
  projectId?: string,
): Promise<string> =>
  (
    await requestJson<NoteFormatResponse>(
      experiencePath(`/notes/${encodeURIComponent(id)}/format`, projectId),
      "POST",
      { prompt },
    )
  ).content;

export const extractArticleContent = (
  params: ExtractArticleContentParams,
  projectId?: string,
): Promise<ExtractArticleContentResponse> =>
  requestJson<ExtractArticleContentResponse>(
    experiencePath("/articles/extract", projectId),
    "POST",
    {
      urls: params.urls,
      extract_depth: params.extractDepth || "basic",
      include_images: params.includeImages || false,
    },
  );

export const prepareSessionForRerun = async (itemId: string, projectId?: string): Promise<void> => {
  await requestJson<unknown>(
    experiencePath(`/articles/${encodeURIComponent(itemId)}/rerun`, projectId),
    "POST",
    {},
  );
};

export const generateNotesFromMedia = (
  params: {
    url: string;
    outputs: (
      | "concise_summary"
      | "detailed_outline"
      | "key_takeaways"
      | "action_items"
      | "meeting_minutes"
      | "qa_extraction"
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
  },
  projectId?: string,
): Promise<{ content: string }> =>
  requestJson<{ content: string }>(experiencePath("/notes/transcribe", projectId), "POST", params);
