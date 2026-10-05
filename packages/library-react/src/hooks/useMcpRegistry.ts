import {
  listNativeMcpServers,
  createNativeMcpServer,
  updateNativeMcpServer,
  deleteNativeMcpServer,
  connectNativeMcpServer,
  disconnectNativeMcpServer,
  discoverNativeMcpServer,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateNativeMcpServer,
  UpdateNativeMcpServer,
  ConnectNativeMcpServer,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useMcpRegistry(workspaceId?: string, enabled = true) {
  const client = useQueryClient();
  const queryKey = ["native-mcp-registry", workspaceId];
  const refresh = () => client.invalidateQueries({ queryKey: ["native-mcp-registry"] });
  const query = useQuery({
    queryKey,
    queryFn: () => listNativeMcpServers(workspaceId),
    enabled,
    staleTime: 0,
  });
  const create = useMutation({
    mutationFn: (input: CreateNativeMcpServer) => createNativeMcpServer(input),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNativeMcpServer }) =>
      updateNativeMcpServer(id, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: ({ id, revision }: { id: string; revision: number }) =>
      deleteNativeMcpServer(id, revision),
    onSuccess: refresh,
  });
  const connect = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConnectNativeMcpServer }) =>
      connectNativeMcpServer(id, input),
    onSuccess: refresh,
  });
  const disconnect = useMutation({ mutationFn: disconnectNativeMcpServer, onSuccess: refresh });
  const discover = useMutation({
    mutationFn: ({ id, revision }: { id: string; revision: number }) =>
      discoverNativeMcpServer(id, revision),
    onSuccess: refresh,
  });

  return { query, create, update, remove, connect, disconnect, discover };
}
