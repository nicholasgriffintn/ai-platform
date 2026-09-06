import {
  fetchRecording,
  fetchRecordings,
  processRecording,
  uploadRecording,
} from "@ngriffin_uk/polychat-library-client";
import type { Recording, RecordingListItem } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useFetchRecordings = (projectId?: string, options?: { enabled?: boolean }) => {
  return useQuery<RecordingListItem[]>({
    queryKey: ["recordings", projectId],
    queryFn: () => fetchRecordings(projectId),
    enabled: options?.enabled ?? true,
  });
};

export const useFetchRecording = (id: string, projectId?: string) => {
  return useQuery<Recording>({
    queryKey: ["recording", projectId, id],
    queryFn: () => fetchRecording(id, projectId),
    enabled: !!id,
  });
};

export const useUploadRecording = (projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof uploadRecording>[0]) =>
      uploadRecording(params, projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recordings", projectId] });
    },
  });
};

export const useProcessRecording = (projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof processRecording>[0]) =>
      processRecording(params, projectId),
    onSuccess: (_, params) => {
      void queryClient.invalidateQueries({
        queryKey: ["recording", projectId, params.recordingId],
      });
      void queryClient.invalidateQueries({ queryKey: ["recordings", projectId] });
    },
  });
};
