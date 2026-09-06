import type { TeammateFormData } from "@ngriffin_uk/polychat-component-account";
import type {
  TeammateResponse,
  HireTeammateInput,
  UpdateTeammateInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiService } from "~/lib/api/api-service";

import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const TEAMMATES_QUERY_KEYS = {
  all: ["teammates"],
  detail: (teammateId: string) => ["teammates", teammateId],
} as const;

export function useTeammate(teammateId?: string) {
  const canAccessProFeatures = useCanAccessProFeatures();

  return useQuery<TeammateResponse>({
    queryKey: TEAMMATES_QUERY_KEYS.detail(teammateId ?? ""),
    queryFn: () => apiService.getTeammate(teammateId ?? ""),
    enabled: canAccessProFeatures && Boolean(teammateId),
    staleTime: 1000 * 60,
  });
}

export function usePublishTeammateToWorkspace() {
  const queryClient = useQueryClient();

  return useMutation<TeammateResponse, Error, { teammateId: string; workspaceId: string }>({
    mutationFn: ({ teammateId, workspaceId }) =>
      apiService.publishTeammateToWorkspace(teammateId, workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMMATES_QUERY_KEYS.all });
    },
  });
}

export function useTeammates({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const canAccessProFeatures = useCanAccessProFeatures();

  const teammatesQuery = useQuery<TeammateResponse[]>({
    queryKey: TEAMMATES_QUERY_KEYS.all,
    queryFn: () => apiService.listTeammates(),
    enabled: canAccessProFeatures && enabled,
    staleTime: 1000 * 60,
  });
  const teammates = useMemo(
    () => (canAccessProFeatures && enabled ? (teammatesQuery.data ?? []) : []),
    [canAccessProFeatures, enabled, teammatesQuery.data],
  );

  const createMutation = useMutation<TeammateResponse, Error, TeammateFormData>({
    mutationFn: (data) => apiService.createTeammate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMMATES_QUERY_KEYS.all });
    },
  });

  const hireMutation = useMutation<TeammateResponse, Error, HireTeammateInput>({
    mutationFn: (data) => apiService.hireTeammate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMMATES_QUERY_KEYS.all });
    },
  });

  const updateMutation = useMutation<
    TeammateResponse,
    Error,
    { id: string; data: UpdateTeammateInput }
  >({
    mutationFn: ({ id, data }) => apiService.updateTeammate(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMMATES_QUERY_KEYS.all });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (teammateId) => apiService.deleteTeammate(teammateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMMATES_QUERY_KEYS.all });
    },
  });

  return {
    teammates,
    isLoadingTeammates: canAccessProFeatures && enabled ? teammatesQuery.isLoading : false,
    errorTeammates: canAccessProFeatures && enabled ? teammatesQuery.error : null,
    createTeammate: createMutation.mutateAsync,
    isCreatingTeammate: createMutation.isPending,
    hireTeammate: hireMutation.mutateAsync,
    isHiringTeammate: hireMutation.isPending,
    hireTeammateError: hireMutation.error,
    resetHireTeammate: hireMutation.reset,
    updateTeammate: updateMutation.mutateAsync,
    isUpdatingTeammate: updateMutation.isPending,
    deleteTeammate: deleteMutation.mutate,
    deleteTeammateAsync: deleteMutation.mutateAsync,
    deleteTeammateError: deleteMutation.error,
    deletingTeammateId: deleteMutation.isPending ? deleteMutation.variables : undefined,
    isDeletingTeammate: deleteMutation.isPending,
    resetTeammateDeletion: deleteMutation.reset,
  };
}
