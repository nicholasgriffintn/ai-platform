import { sitesService } from "@ngriffin_uk/polychat-library-client";
import type { SiteDataAction, SiteDataResponse, SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { SITES_QUERY_KEYS } from "./useSites.js";

export function useSiteIntegrations(site: SiteRecord | null, options: { enabled?: boolean } = {}) {
  const client = useQueryClient();
  const scope = { projectId: site?.projectId ?? undefined, expectedRevision: site?.revision ?? 1 };
  const key = [...SITES_QUERY_KEYS.detail(scope.projectId, site?.id), "data", site?.revision];
  const requireSite = () => {
    if (!site) {
      throw new Error("Save the site first");
    }

    return site;
  };

  const data = useQuery({
    queryKey: key,
    queryFn: () => sitesService.data(requireSite().id, scope),
    enabled:
      Boolean(site) &&
      options.enabled !== false &&
      Boolean(site?.project.collections || site?.project.dataBindings),
  });
  const action = useMutation({
    mutationFn: (operation: SiteDataAction) =>
      sitesService.dataAction(requireSite().id, { ...scope, operation }),
    onSuccess: (result: SiteDataResponse) => client.setQueryData(key, result),
  });
  const storage = useMutation({
    mutationFn: (enabled: boolean) =>
      enabled
        ? sitesService.activateStorage(requireSite().id, scope)
        : sitesService.disableStorage(requireSite().id, scope),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const verify = useMutation({
    mutationFn: (request: { pageId?: string; repair?: boolean; signal?: AbortSignal }) =>
      sitesService.verify(
        requireSite().id,
        { ...scope, pageId: request.pageId, repair: request.repair ?? false, interactions: [] },
        request.signal,
      ),
    onSuccess: (result) => {
      if (result.repairedFromRevision !== undefined) {
        void client.invalidateQueries({
          queryKey: SITES_QUERY_KEYS.detail(scope.projectId, site?.id),
        });
      }
    },
  });
  const { mutateAsync } = action;
  const runAction = useCallback(
    async (operation: SiteDataAction) => {
      await mutateAsync(operation);
    },
    [mutateAsync],
  );

  return { data, action, storage, verify, runAction };
}
