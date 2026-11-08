import {
  fetchRemoteApps,
  openMcpAppEntry,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type { AppEntry } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

export const REMOTE_APPS_QUERY_KEY = ["remoteApps"] as const;

const REMOTE_APPS_STALE_TIME = 60 * 1000;

type RemoteAppEntry = Extract<AppEntry, { kind: "remote" }>;

export function useRemoteApps(options: { enabled?: boolean } = {}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);

  return useQuery({
    queryKey: REMOTE_APPS_QUERY_KEY,
    queryFn: fetchRemoteApps,
    select: (response) => response.apps,
    enabled: (options.enabled ?? true) && isAuthenticated && !isAuthenticationLoading,
    staleTime: REMOTE_APPS_STALE_TIME,
  });
}

export function useRemoteAppView(entry: RemoteAppEntry) {
  return useQuery({
    queryKey: ["remoteAppView", entry.server, entry.tool] as const,
    queryFn: () => openMcpAppEntry({ integration: entry.server, tool: entry.tool }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
