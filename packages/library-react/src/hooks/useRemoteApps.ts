import {
  fetchRemoteApps,
  openMcpAppEntry,
  setRemoteAppEnabled,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type { AppEntry, RemoteAppListResponse } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useSetRemoteAppEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, enabled }: { appId: string; enabled: boolean }) =>
      setRemoteAppEnabled(appId, enabled),
    onSuccess: ({ id, enabled }) => {
      queryClient.setQueryData<RemoteAppListResponse>(REMOTE_APPS_QUERY_KEY, (current) =>
        current
          ? { apps: current.apps.map((app) => (app.id === id ? { ...app, enabled } : app)) }
          : current,
      );
    },
  });
}
