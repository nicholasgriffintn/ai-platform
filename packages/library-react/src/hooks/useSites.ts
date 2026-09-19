import { sitesService } from "@ngriffin_uk/polychat-library-client";
import { applySitePatch, validateSiteProject } from "@ngriffin_uk/polychat-library-sites";
import type {
  SiteBuildRequest,
  SiteBuildResponse,
  SiteGenerateRequest,
  SiteIssue,
  SitePlan,
  SiteProject,
  SiteRecord,
  SiteStreamEvent,
  SiteSummary,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export const SITES_QUERY_KEYS = {
  root: ["sites"] as const,
  list: (projectId?: string) => [...SITES_QUERY_KEYS.root, projectId, "list"] as const,
  detail: (projectId?: string, id?: string) =>
    [...SITES_QUERY_KEYS.root, projectId, "site", id] as const,
};

export const useSites = (projectId?: string, options?: { enabled?: boolean }) =>
  useQuery<SiteSummary[]>({
    queryKey: SITES_QUERY_KEYS.list(projectId),
    queryFn: () => sitesService.list(projectId),
    enabled: options?.enabled ?? true,
  });

export const useSite = (id?: string, projectId?: string) =>
  useQuery<SiteRecord>({
    queryKey: SITES_QUERY_KEYS.detail(projectId, id),
    queryFn: () => {
      if (!id) {
        throw new Error("Site id is required");
      }

      return sitesService.get(id, projectId);
    },
    enabled: Boolean(id),
  });

export const useDeleteSite = (projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => sitesService.delete(id, projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEYS.list(projectId) });
    },
  });
};

export const useBuildSite = () =>
  useMutation<SiteBuildResponse, Error, { id: string; request: SiteBuildRequest }>({
    mutationFn: ({ id, request }) => sitesService.build(id, request),
  });

export type SiteGenerationStatus = "idle" | "planning" | "streaming" | "saving" | "done" | "error";

export interface SiteGenerationState {
  status: SiteGenerationStatus;
  plan: SitePlan | null;
  project: SiteProject | null;
  site: SiteRecord | null;
  issues: SiteIssue[];
  error: string | null;
  patchCount: number;
  model: { provider: string; model: string } | null;
}

const IDLE_STATE: SiteGenerationState = {
  status: "idle",
  plan: null,
  project: null,
  site: null,
  issues: [],
  error: null,
  patchCount: 0,
  model: null,
};

export interface UseSiteGenerationOptions {
  projectId?: string;
  initialSite?: SiteRecord | null;
}

export function useSiteGeneration({ projectId, initialSite }: UseSiteGenerationOptions = {}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SiteGenerationState>(() =>
    initialSite
      ? {
          ...IDLE_STATE,
          status: "done",
          plan: initialSite.plan,
          project: initialSite.project,
          site: initialSite,
          issues: initialSite.issues,
        }
      : IDLE_STATE,
  );
  const documentRef = useRef<Record<string, unknown>>({});
  const projectRef = useRef<SiteProject | null>(initialSite?.project ?? null);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const patchCountRef = useRef(0);

  const flushDocument = useCallback(() => {
    frameRef.current = null;

    const { project } = validateSiteProject(documentRef.current);

    setState((previous) => ({
      ...previous,
      project: Object.keys(project.pages).length > 0 ? project : previous.project,
      patchCount: patchCountRef.current,
    }));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(flushDocument)
        : setTimeout(flushDocument, 16);
  }, [flushDocument]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  useEffect(() => {
    projectRef.current = state.project;
  }, [state.project]);

  const generate = useCallback(
    async (request: Omit<SiteGenerateRequest, "projectId">) => {
      cancel();

      const controller = new AbortController();

      abortRef.current = controller;
      patchCountRef.current = 0;

      const refining = Boolean(request.siteId);

      documentRef.current =
        refining && projectRef.current ? structuredClone(projectRef.current) : {};

      setState((previous) => ({
        ...IDLE_STATE,
        status: "planning",
        project: refining ? previous.project : null,
        site: refining ? previous.site : null,
        plan: refining ? previous.plan : null,
      }));

      const handleEvent = (event: SiteStreamEvent) => {
        switch (event.type) {
          case "plan":
            documentRef.current = {
              ...documentRef.current,
              theme: documentRef.current.theme ?? event.plan.theme,
            };
            setState((previous) => ({ ...previous, status: "streaming", plan: event.plan }));
            break;
          case "model":
            setState((previous) => ({
              ...previous,
              model: { provider: event.provider, model: event.model },
            }));
            break;
          case "patch":
            try {
              applySitePatch(documentRef.current, event.patch);
              patchCountRef.current += 1;
              scheduleFlush();
            } catch {
              break;
            }

            break;
          case "saved":
            setState((previous) => ({
              ...previous,
              status: "saving",
              site: event.site,
              project: event.site.project,
              plan: event.site.plan,
            }));
            queryClient.setQueryData(SITES_QUERY_KEYS.detail(projectId, event.site.id), event.site);
            void queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEYS.list(projectId) });
            break;
          case "done":
            setState((previous) => ({ ...previous, status: "done", issues: event.issues }));
            break;
          case "error":
            setState((previous) => ({ ...previous, status: "error", error: event.error }));
            break;
          default:
            break;
        }
      };

      try {
        await sitesService.generate({ ...request, projectId }, handleEvent, controller.signal);
        setState((previous) =>
          previous.status === "streaming" || previous.status === "planning"
            ? { ...previous, status: "error", error: "The stream ended before the site was saved" }
            : previous,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          setState((previous) => ({ ...previous, status: previous.site ? "done" : "idle" }));

          return;
        }

        setState((previous) => ({
          ...previous,
          status: "error",
          error: getErrorMessage(error, "The site could not be generated"),
        }));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [cancel, projectId, queryClient, scheduleFlush],
  );

  const reset = useCallback(() => {
    cancel();
    documentRef.current = {};
    patchCountRef.current = 0;
    setState(IDLE_STATE);
  }, [cancel]);

  return { state, generate, cancel, reset };
}
