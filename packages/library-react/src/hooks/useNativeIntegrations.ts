import {
  connectNativeIntegration,
  createNativeIntegration,
  disconnectNativeIntegration,
  listNativeIntegrations,
  refreshNativeIntegration,
  reviewNativeIntegration,
  revokeNativeIntegration,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCanAccessProFeatures } from "./useCanAccessProFeatures.js";
import { CAPABILITY_CATALOG_QUERY_KEY } from "./useCapabilityCatalog.js";

export const NATIVE_INTEGRATIONS_QUERY_KEY = ["native-integrations"] as const;

export function useNativeIntegrations(scope: { workspaceId?: string; projectId?: string }) {
  const canAccessProFeatures = useCanAccessProFeatures();

  return useQuery({
    queryKey: [
      ...NATIVE_INTEGRATIONS_QUERY_KEY,
      scope.workspaceId ?? "personal",
      scope.projectId ?? "",
    ],
    queryFn: () => listNativeIntegrations(scope),
    enabled: canAccessProFeatures,
    staleTime: 30_000,
  });
}

export function useNativeIntegrationActions() {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: NATIVE_INTEGRATIONS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: CAPABILITY_CATALOG_QUERY_KEY });
  };

  const create = useMutation({ mutationFn: createNativeIntegration, onSuccess: invalidate });
  const connect = useMutation({
    mutationFn: ({ id, token }: { id: string; token?: string }) =>
      connectNativeIntegration(id, token),
    onSuccess: invalidate,
  });
  const disconnect = useMutation({
    mutationFn: disconnectNativeIntegration,
    onSuccess: invalidate,
  });
  const review = useMutation({ mutationFn: reviewNativeIntegration });
  const refresh = useMutation({ mutationFn: refreshNativeIntegration, onSuccess: invalidate });
  const revoke = useMutation({ mutationFn: revokeNativeIntegration, onSuccess: invalidate });

  return { create, connect, disconnect, review, refresh, revoke };
}
