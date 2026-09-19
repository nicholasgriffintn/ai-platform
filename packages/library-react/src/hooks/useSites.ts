import { sitesService } from "@ngriffin_uk/polychat-library-client";
import {
  applySitePatch,
  collectEmptySiteImageSlots,
  hasRenderableSiteContent,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  SiteBuildRequest,
  SiteBuildResponse,
  SiteGenerateRequest,
  SiteIssue,
  SitePatch,
  SitePlan,
  SiteProject,
  SitePullRequestRequest,
  SitePullRequestResponse,
  SiteQuality,
  SiteRefineIntent,
  SiteElementTarget,
  SiteRecord,
  SiteStreamEvent,
  SiteSummary,
  SiteTraceEntry,
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

export const useOpenSitePullRequest = () =>
  useMutation<SitePullRequestResponse, Error, { id: string; request: SitePullRequestRequest }>({
    mutationFn: ({ id, request }) => sitesService.pullRequest(id, request),
  });

export type SiteGenerationStatus =
  | "idle"
  | "planning"
  | "selecting"
  | "streaming"
  | "reviewing"
  | "repairing"
  | "saving"
  | "done"
  | "error";

export interface SiteGenerationState {
  status: SiteGenerationStatus;
  plan: SitePlan | null;
  project: SiteProject | null;
  site: SiteRecord | null;
  issues: SiteIssue[];
  error: string | null;
  patchCount: number;
  model: { provider: string; model: string } | null;
  imageStatus: "idle" | "generating" | "done" | "failed";
  quality: SiteQuality | null;
  intent: { intent: SiteRefineIntent; target: SiteElementTarget | null } | null;
  trace: SiteTraceEntry[];
  pendingPrompt: string | null;
  pendingTarget: SiteElementTarget | null;
  firstPreviewLatencyMs: number | null;
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
  imageStatus: "idle",
  quality: null,
  intent: null,
  trace: [],
  pendingPrompt: null,
  pendingTarget: null,
  firstPreviewLatencyMs: null,
};

export interface UseSiteGenerationOptions {
  projectId?: string;
  initialSite?: SiteRecord | null;
  autoImages?: boolean;
}

export function useSiteGeneration({
  projectId,
  initialSite,
  autoImages = true,
}: UseSiteGenerationOptions = {}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SiteGenerationState>(() => {
    if (!initialSite) {
      return IDLE_STATE;
    }

    const lastTurn = initialSite.turns.at(-1);

    return {
      ...IDLE_STATE,
      status: "done",
      plan: initialSite.plan,
      project: initialSite.project,
      site: initialSite,
      issues: initialSite.issues,
      quality: initialSite.quality,
      model:
        lastTurn?.provider && lastTurn.model
          ? { provider: lastTurn.provider, model: lastTurn.model }
          : null,
      trace: lastTurn?.trace ?? [],
    };
  });
  const documentRef = useRef<Record<string, unknown>>({});
  const projectRef = useRef<SiteProject | null>(initialSite?.project ?? null);
  const siteRef = useRef<SiteRecord | null>(initialSite ?? null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const patchCountRef = useRef(0);
  const generationStartedAtRef = useRef<number | null>(null);
  const firstPreviewRecordedRef = useRef(false);

  const flushDocument = useCallback(() => {
    frameRef.current = null;

    const { project } = validateSiteProject(documentRef.current);
    const renderable = hasRenderableSiteContent(project);
    const firstPreviewLatencyMs =
      renderable && !firstPreviewRecordedRef.current && generationStartedAtRef.current !== null
        ? Date.now() - generationStartedAtRef.current
        : null;

    if (firstPreviewLatencyMs !== null) {
      firstPreviewRecordedRef.current = true;
    }

    setState((previous) => ({
      ...previous,
      project: renderable ? project : previous.project,
      patchCount: patchCountRef.current,
      firstPreviewLatencyMs: previous.firstPreviewLatencyMs ?? firstPreviewLatencyMs,
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

  const generateImages = useCallback(async () => {
    const site = siteRef.current;

    if (!site || collectEmptySiteImageSlots(site.project).length === 0) {
      return;
    }

    setState((previous) => ({ ...previous, imageStatus: "generating" }));

    try {
      const result = await sitesService.images(site.id, { projectId });

      setState((previous) => ({
        ...previous,
        imageStatus: result.generated > 0 ? "done" : "failed",
        site: result.site,
        project:
          previous.status === "streaming" || previous.status === "planning"
            ? previous.project
            : result.site.project,
      }));
      siteRef.current = result.site;
      queryClient.setQueryData(SITES_QUERY_KEYS.detail(projectId, result.site.id), result.site);
    } catch {
      setState((previous) => ({ ...previous, imageStatus: "failed" }));
    }
  }, [projectId, queryClient]);

  const generate = useCallback(
    async (request: Omit<SiteGenerateRequest, "projectId">) => {
      cancel();

      const controller = new AbortController();
      const refining = Boolean(request.siteId);

      abortRef.current = controller;
      patchCountRef.current = 0;
      generationStartedAtRef.current = refining ? null : Date.now();
      firstPreviewRecordedRef.current = refining;

      documentRef.current =
        refining && projectRef.current ? structuredClone(projectRef.current) : {};

      setState((previous) => ({
        ...IDLE_STATE,
        status: "planning",
        project: refining ? previous.project : null,
        site: refining ? previous.site : null,
        plan: refining ? previous.plan : null,
        pendingPrompt: request.prompt,
        pendingTarget: request.target ?? null,
      }));

      const handleEvent = (event: SiteStreamEvent) => {
        switch (event.type) {
          case "plan":
            documentRef.current = {
              ...documentRef.current,
              theme: documentRef.current.theme ?? event.plan.theme,
            };
            setState((previous) => ({ ...previous, plan: event.plan }));
            break;
          case "model":
            setState((previous) => ({
              ...previous,
              model: { provider: event.provider, model: event.model },
            }));
            break;
          case "intent":
            setState((previous) => ({
              ...previous,
              intent: { intent: event.intent, target: event.target },
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
          case "trace":
            setState((previous) => ({
              ...previous,
              trace: [
                ...previous.trace.filter((entry) => entry.id !== event.entry.id),
                event.entry,
              ],
            }));
            break;
          case "phase":
            setState((previous) => ({ ...previous, status: event.phase }));
            break;
          case "saved":
            siteRef.current = event.site;
            setState((previous) => ({
              ...previous,
              status: event.stage === "initial" ? "reviewing" : "saving",
              site: event.site,
              project: event.site.project,
              plan: event.site.plan,
              trace: event.site.turns.at(-1)?.trace ?? previous.trace,
              pendingPrompt: event.stage === "final" ? null : previous.pendingPrompt,
              pendingTarget: event.stage === "final" ? null : previous.pendingTarget,
            }));
            queryClient.setQueryData(SITES_QUERY_KEYS.detail(projectId, event.site.id), event.site);
            void queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEYS.list(projectId) });
            break;
          case "done":
            setState((previous) => ({
              ...previous,
              status: "done",
              issues: event.issues,
              quality: event.quality ?? previous.quality,
            }));
            generationStartedAtRef.current = null;

            if (autoImages && !refining) {
              void generateImages();
            }

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
          previous.status === "streaming" ||
          previous.status === "planning" ||
          previous.status === "selecting" ||
          previous.status === "reviewing" ||
          previous.status === "repairing" ||
          previous.status === "saving"
            ? { ...previous, status: "error", error: "The stream ended before the site was saved" }
            : previous,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          generationStartedAtRef.current = null;
          setState((previous) => ({
            ...previous,
            status: previous.site ? "done" : "idle",
            pendingPrompt: null,
            pendingTarget: null,
          }));

          return;
        }

        generationStartedAtRef.current = null;
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
    [autoImages, cancel, generateImages, projectId, queryClient, scheduleFlush],
  );

  const reset = useCallback(() => {
    cancel();
    documentRef.current = {};
    patchCountRef.current = 0;
    generationStartedAtRef.current = null;
    firstPreviewRecordedRef.current = false;
    siteRef.current = null;
    setState(IDLE_STATE);
  }, [cancel]);

  const pendingEditsRef = useRef<{ patches: SitePatch[]; summaries: string[] }>({
    patches: [],
    summaries: [],
  });
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistEdits = useCallback(async () => {
    persistTimerRef.current = null;

    const siteId = stateRef.current.site?.id;
    const pending = pendingEditsRef.current;

    if (!siteId || pending.patches.length === 0) {
      return;
    }

    pendingEditsRef.current = { patches: [], summaries: [] };

    try {
      const saved = await sitesService.edit(siteId, {
        projectId,
        patches: pending.patches,
        summary: [...new Set(pending.summaries)].join(", ").slice(0, 200),
      });

      setState((previous) => ({ ...previous, site: saved, issues: saved.issues }));
      siteRef.current = saved;
      queryClient.setQueryData(SITES_QUERY_KEYS.detail(projectId, saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEYS.list(projectId) });
    } catch (error) {
      setState((previous) => ({ ...previous, error: getErrorMessage(error, "Edit not saved") }));
    }
  }, [projectId, queryClient]);

  const edit = useCallback(
    (patches: SitePatch[], summary: string) => {
      if (patches.length === 0 || !projectRef.current) {
        return;
      }

      if (Object.keys(documentRef.current).length === 0) {
        documentRef.current = structuredClone(projectRef.current);
      }

      for (const patch of patches) {
        try {
          applySitePatch(documentRef.current, patch);
        } catch {
          return;
        }
      }

      const { project } = validateSiteProject(documentRef.current);

      documentRef.current = structuredClone(project);
      projectRef.current = project;
      setState((previous) => ({ ...previous, project }));

      pendingEditsRef.current.patches.push(...patches);
      pendingEditsRef.current.summaries.push(summary);

      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }

      persistTimerRef.current = setTimeout(() => void persistEdits(), 800);
    },
    [persistEdits],
  );

  useEffect(
    () => () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        void persistEdits();
      }
    },
    [persistEdits],
  );

  const load = useCallback(
    (site: SiteRecord) => {
      const lastTurn = site.turns.at(-1);

      cancel();
      documentRef.current = structuredClone(site.project);
      projectRef.current = site.project;
      siteRef.current = site;
      patchCountRef.current = 0;
      generationStartedAtRef.current = null;
      firstPreviewRecordedRef.current = false;
      setState({
        ...IDLE_STATE,
        status: "done",
        plan: site.plan,
        project: site.project,
        site,
        issues: site.issues,
        quality: site.quality,
        model:
          lastTurn?.provider && lastTurn.model
            ? { provider: lastTurn.provider, model: lastTurn.model }
            : null,
        trace: lastTurn?.trace ?? [],
      });
    },
    [cancel],
  );

  return { state, generate, edit, generateImages, load, cancel, reset };
}
