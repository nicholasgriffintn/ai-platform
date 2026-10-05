import {
  getWorkspaceIdentity,
  createWorkspaceIdentity,
  updateWorkspaceIdentity,
  deleteWorkspaceIdentity,
  listLinkedEnterpriseIdentities,
} from "@ngriffin_uk/polychat-library-client";
import type { CreateOidcConnection, UpdateOidcConnection } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStatus } from "./useAuth.js";

export function useWorkspaceIdentity(workspaceId: string, enabled: boolean) {
  const client = useQueryClient();
  const queryKey = ["workspace-identity", workspaceId];
  const query = useQuery({ queryKey, queryFn: () => getWorkspaceIdentity(workspaceId), enabled });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey }),
      client.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
      client.invalidateQueries({ queryKey: ["workspaces"] }),
      client.invalidateQueries({ queryKey: ["enterprise-identities"] }),
    ]);
  };

  const create = useMutation({
    mutationFn: (input: CreateOidcConnection) => createWorkspaceIdentity(workspaceId, input),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (input: UpdateOidcConnection) => updateWorkspaceIdentity(workspaceId, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteWorkspaceIdentity(workspaceId),
    onSuccess: refresh,
  });

  return { query, create, update, remove };
}

export function useLinkedEnterpriseIdentities() {
  const { isAuthenticated } = useAuthStatus();

  return useQuery({
    queryKey: ["enterprise-identities"],
    queryFn: listLinkedEnterpriseIdentities,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}
