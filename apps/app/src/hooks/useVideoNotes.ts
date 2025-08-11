import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Note } from "~/types/note";
import type { VideoNoteCreationRequest, VideoNoteResponse } from "~/types/video-note";
import {
  checkVideoNoteStatus,
  createVideoNote as createVideoNoteApi,
  deleteVideoNote as deleteVideoNoteApi,
  getVideoNote as getVideoNoteApi,
  getVideoNotes as getVideoNotesApi,
} from "~/lib/api/video-notes";

export const useGetVideoNotes = () => {
  return useQuery<Note[], Error>({
    queryKey: ["video-notes"],
    queryFn: getVideoNotesApi,
  });
};

export const useGetVideoNote = (id: string | undefined) => {
  return useQuery<Note, Error>({
    queryKey: ["video-note", id],
    queryFn: () => getVideoNoteApi(id!),
    enabled: !!id,
  });
};

export const useCreateVideoNote = () => {
  const queryClient = useQueryClient();
  return useMutation<VideoNoteResponse, Error, VideoNoteCreationRequest>({
    mutationFn: (params) => createVideoNoteApi(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-notes"] });
    },
  });
};

export const useDeleteVideoNote = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteVideoNoteApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-notes"] });
    },
  });
};

export const useCheckProcessingStatus = (id: string | undefined) => {
  return useQuery<{ status?: string; progress?: number }, Error>({
    queryKey: ["video-note-status", id],
    queryFn: () => checkVideoNoteStatus(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "processing" || status === "pending") return 2000;
      return false;
    },
  });
};