import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createNote,
  deleteNote,
  fetchNote,
  fetchNotes,
  updateNote,
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
