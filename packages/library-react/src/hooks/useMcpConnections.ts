import {
  createMcpConnection,
  deleteMcpConnection,
  listMcpConnections,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const KEY = ["mcp-connections"] as const;

export function useMcpConnections(enabled = true) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });

  return {
    query: useQuery({
      queryKey: KEY,
      queryFn: listMcpConnections,
      enabled: enabled && isAuthenticated,
    }),
    create: useMutation({ mutationFn: createMcpConnection, onSuccess: refresh, gcTime: 0 }),
    remove: useMutation({ mutationFn: deleteMcpConnection, onSuccess: refresh }),
  };
}
