import {
  fetchRemoteApps,
  isImageSourceAllowed,
  openMcpAppEntry,
  setAppEnabled,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type {
  AppEntry,
  CapabilityCatalogResponse,
  ProjectExperienceDefinition,
  RemoteApp,
  RemoteAppListResponse,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { capabilityCatalogQueryKey } from "./useCapabilityCatalog.js";

export const REMOTE_APPS_QUERY_KEY = ["remoteApps"] as const;

const REMOTE_APPS_STALE_TIME = 60 * 1000;

type RemoteAppEntry = Extract<AppEntry, { kind: "remote" }>;

const withRenderableIcon = (app: RemoteApp): RemoteApp =>
  app.icon?.startsWith("https://") && !isImageSourceAllowed(app.icon)
    ? { ...app, icon: "app" }
    : app;

export function useRemoteApps(options: { enabled?: boolean } = {}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);

  return useQuery({
    queryKey: REMOTE_APPS_QUERY_KEY,
    queryFn: fetchRemoteApps,
    select: (response) => response.apps.map(withRenderableIcon),
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

const withEnabled =
  <App extends ProjectExperienceDefinition>(id: string, enabled: boolean) =>
  (app: App): App =>
    app.id === id ? { ...app, enabled } : app;

export function useSetAppEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, enabled }: { appId: string; enabled: boolean }) =>
      setAppEnabled(appId, enabled),
    onSuccess: ({ id, enabled }) => {
      queryClient.setQueryData<RemoteAppListResponse>(REMOTE_APPS_QUERY_KEY, (current) =>
        current ? { apps: current.apps.map(withEnabled(id, enabled)) } : current,
      );
      queryClient.setQueryData<CapabilityCatalogResponse>(
        capabilityCatalogQueryKey(undefined),
        (current) =>
          current
            ? { ...current, experiences: current.experiences.map(withEnabled(id, enabled)) }
            : current,
      );
    },
  });
}
