import type {
  AnalyseArticleParams,
  ArticleResponse,
  ArticleSessionSummary,
  ArticlesResponse,
  ExtractArticleContentParams,
  ExtractArticleContentResponse,
  FetchMultipleArticlesResponse,
  GenerateReportParams,
  SummariseArticleParams,
  Note,
  NoteSummary,
  NoteCreateRequest,
  NoteDetailResponse,
  NoteFormatResponse,
  NoteUpdateRequest,
} from "@ngriffin_uk/polychat-schemas";

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
