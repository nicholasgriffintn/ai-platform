import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Note, NoteCreateRequest, NoteUpdateRequest } from "@ngriffin_uk/polychat-schemas";

import {
	createNote,
	deleteNote,
	fetchNote,
	fetchNotes,
	formatNoteAPI,
	updateNote,
	generateNotesFromMedia,
} from "~/lib/api/apps";

export const useFetchNotes = (projectId?: string, options?: { enabled?: boolean }) => {
	return useQuery<Note[], Error>({
		queryKey: ["notes", projectId],
		queryFn: () => fetchNotes(projectId),
		enabled: options?.enabled ?? true,
	});
};

export const useFetchNote = (id: string | undefined, projectId?: string) => {
	return useQuery<Note, Error>({
		queryKey: ["note", projectId, id],
		queryFn: () => fetchNote(id!, projectId),
		enabled: !!id,
	});
};

export const useCreateNote = (projectId?: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: NoteCreateRequest) => createNote(data, projectId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notes", projectId] });
		},
	});
};

export const useUpdateNote = (id: string, projectId?: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: NoteUpdateRequest) => updateNote({ id, ...data }, projectId),
		onSuccess: (note) => {
			queryClient.invalidateQueries({ queryKey: ["notes", projectId] });
			queryClient.setQueryData(["note", projectId, id], note);
		},
	});
};

export const useDeleteNote = (projectId?: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteNote(id, projectId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notes", projectId] });
		},
	});
};

export const useFormatNote = (id: string, projectId?: string) => {
	return useMutation<string, Error, string | undefined>({
		mutationFn: (prompt?: string) => {
			if (!id) {
				throw new Error("Note ID is required");
			}
			return formatNoteAPI(id, prompt, projectId);
		},
	});
};

export const useGenerateNotesFromMedia = (projectId?: string) => {
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
		mutationFn: (params) => generateNotesFromMedia(params, projectId),
	});
};
