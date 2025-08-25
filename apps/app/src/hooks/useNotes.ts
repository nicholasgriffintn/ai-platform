import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createNote,
  deleteNote,
  fetchNote,
  fetchNotes,
  formatNoteAPI,
  updateNote,
  generateNotesFromMedia,
} from "~/lib/api/dynamic-apps";
import type { Note } from "~/types/note";

export const useFetchNotes = () => {
  return useQuery<Note[], Error>({
    queryKey: ["notes"],
    queryFn: fetchNotes,
  });
};

export const useFetchNote = (id: string | undefined) => {
  return useQuery<Note, Error>({
    queryKey: ["note", id],
    queryFn: () => fetchNote(id!),
    enabled: !!id,
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content: string; metadata?: any }) =>
      createNote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
};

export const useUpdateNote = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content: string; metadata?: any }) =>
      updateNote({ id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note", id] });
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
};

export const useFormatNote = (id: string) => {
  return useMutation<string, Error, string | undefined>({
    mutationFn: (prompt?: string) => {
      if (!id) {
        throw new Error("Note ID is required");
      }
      return formatNoteAPI(id, prompt);
    },
  });
};

export const useGenerateNotesFromMedia = () => {
  return useMutation<
    { content: string },
    Error,
    {
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
    }
  >({
    mutationFn: (params) => generateNotesFromMedia(params),
  });
};
