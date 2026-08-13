import type {
	AppSchema,
	DynamicAppsResponse,
	ListNotesResponse,
	ListPodcastsResponse,
	Note,
	NoteCreateRequest,
	NoteDetailResponse,
	NoteFormatResponse,
	NoteUpdateRequest,
	Podcast,
	PodcastDetailResponse,
	PodcastListItem,
} from "@ngriffin_uk/polychat-schemas";
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
import type { ProcessPodcastParams, UploadPodcastParams, UploadResponse } from "~/types/podcast";
import { apiService } from "./api-service";
import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import { fetchApi } from "./fetch-wrapper";
import { withProjectScope } from "@ngriffin_uk/polychat-library-client/project-scope";

export interface DynamicAppExecutionResult {
	success: boolean;
	output_id?: string;
	data: {
		message: string;
		timestamp: string;
		input: Record<string, unknown>;
		result: unknown;
	};
}

export const fetchDynamicApps = async (): Promise<DynamicAppsResponse> => {
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

		return await returnFetchedData<DynamicAppsResponse>(response);
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

		const data = await returnFetchedData<AppSchema>(response);
		return data;
	} catch (error) {
		console.error(`Error fetching dynamic app ${id}:`, error);
		throw error;
	}
};

export const executeDynamicApp = async (
	id: string,
	formData: Record<string, any>,
	projectId: string,
): Promise<DynamicAppExecutionResult> => {
	try {
		let headers = {};
		try {
			headers = await apiService.getHeaders();
		} catch (error) {
			console.error("Error executing dynamic app:", error);
		}

		const response = await fetchApi(
			`/dynamic-apps/${id}/execute?projectId=${encodeURIComponent(projectId)}`,
			{
				method: "POST",
				body: formData,
				headers,
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to execute dynamic app: ${response.statusText}`);
		}

		return (await response.json()) as DynamicAppExecutionResult;
	} catch (error) {
		console.error(`Error executing dynamic app ${id}:`, error);
		throw error;
	}
};

export const fetchPodcasts = async (projectId?: string): Promise<PodcastListItem[]> => {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error fetching podcasts:", error);
	}

	const response = await fetchApi(withProjectScope("/apps/podcasts", projectId), {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch podcasts: ${response.statusText}`);
	}

	const data = await returnFetchedData<ListPodcastsResponse>(response);
	return data.podcasts || [];
};

export const fetchPodcast = async (id: string, projectId?: string): Promise<Podcast> => {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error fetching podcast:", error);
	}

	const response = await fetchApi(withProjectScope(`/apps/podcasts/${id}`, projectId), {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch podcast: ${response.statusText}`);
	}

	const data = await returnFetchedData<PodcastDetailResponse>(response);
	return data.podcast;
};

export const uploadPodcast = async (
	params: UploadPodcastParams,
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
		console.error("Error uploading podcast:", error);
	}

	const filteredHeaders = { ...headers };

	const response = await fetchApi(withProjectScope("/apps/podcasts/upload", projectId), {
		method: "POST",
		body: formData,
		headers: filteredHeaders,
	});

	if (!response.ok) {
		throw new Error(`Failed to upload podcast: ${response.statusText}`);
	}

	return await returnFetchedData<UploadResponse>(response);
};

export const processPodcast = async (params: ProcessPodcastParams, projectId?: string) => {
	const endpoint = withProjectScope(`/apps/podcasts/${params.action}`, projectId);
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
	if (!ids.length) return { articles: [] };

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
			| "podcast"
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
