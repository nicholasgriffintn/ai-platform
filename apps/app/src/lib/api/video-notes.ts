import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";
import type {
  VideoNoteCreationRequest,
  VideoNoteResponse,
} from "~/types/video-note";
import type { Note } from "~/types/note";

export const createVideoNote = async (
  params: VideoNoteCreationRequest,
): Promise<VideoNoteResponse> => {
  let headers = {} as Record<string, string>;
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for video notes:", e);
  }

  const response = await fetchApi("/video/notes", {
    method: "POST",
    headers,
    body: params,
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message || `Failed to create video note: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { response: { data: VideoNoteResponse } };
  return data.response.data;
};

export const getVideoNotes = async (): Promise<Note[]> => {
  let headers = {} as Record<string, string>;
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for video notes:", e);
  }

  const response = await fetchApi("/apps/notes", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }

  const data = (await response.json()) as { notes: Note[] };
  // Filter to video-notes app entries will be handled via backend when a dedicated listing exists.
  return data.notes;
};

export const getVideoNote = async (id: string): Promise<Note> => {
  let headers = {} as Record<string, string>;
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for video note:", e);
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

export const checkVideoNoteStatus = async (
  id: string,
): Promise<{ status?: string; progress?: number }> => {
  let headers = {} as Record<string, string>;
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for video note status:", e);
  }

  const response = await fetchApi(`/video/notes/${id}/status`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as any;
    throw new Error(
      errData?.message || `Failed to fetch status: ${response.statusText}`,
    );
  }

  return (await response.json()) as { status?: string; progress?: number };
};

export const deleteVideoNote = async (id: string): Promise<void> => {
  let headers = {} as Record<string, string>;
  try {
    headers = await apiService.getHeaders();
  } catch (e) {
    console.error("Error getting headers for delete video note:", e);
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