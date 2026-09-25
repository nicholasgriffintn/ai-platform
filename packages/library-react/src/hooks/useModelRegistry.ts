import {
  checkHuggingFaceToken,
  createEvalSuite,
  createModelRoute,
  deleteEvalSuite,
  deleteHuggingFaceConnection,
  deployModelVersion,
  dryRunModelPolicy,
  exportModelBom,
  getHuggingFaceConnection,
  getModelPolicies,
  getModelRouteHealth,
  getModelVersion,
  importModelAsset,
  listEvalCaseResults,
  listEvalRuns,
  listEvalSuites,
  listModelBuilds,
  listModelDecisions,
  listModelLibrary,
  listModelRoutes,
  listRouteSuggestions,
  reinspectModelVersion,
  requestModelDecision,
  resolveModelDecision,
  retireModelRoute,
  saveHuggingFaceConnection,
  saveModelPolicy,
  searchModelSources,
  startEvalRuns,
  startModelBuild,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateEvalSuiteRequest,
  CreateRouteRequest,
  DeployVersionRequest,
  ImportAssetRequest,
  ModelAssetKind,
  ModelDecisionState,
  PolicyDryRunRequest,
  RequestDecisionInput,
  ResolveDecisionInput,
  SaveHuggingFaceConnectionRequest,
  StartBuildRequest,
  UpsertPolicyRequest,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const POLL_MS = 10_000;

export const modelRegistryKeys = {
  all: (workspaceId: string) => ["model-registry", workspaceId] as const,
  library: (workspaceId: string, projectId?: string) =>
    ["model-registry", workspaceId, "library", projectId ?? null] as const,
  sources: (workspaceId: string, q: string, kind: ModelAssetKind, projectId?: string) =>
    ["model-registry", workspaceId, "sources", q, kind, projectId ?? null] as const,
  version: (workspaceId: string, versionId: string, projectId?: string) =>
    ["model-registry", workspaceId, "version", versionId, projectId ?? null] as const,
  suggestions: (workspaceId: string, versionId: string) =>
    ["model-registry", workspaceId, "suggestions", versionId] as const,
  policies: (workspaceId: string) => ["model-registry", workspaceId, "policies"] as const,
  decisions: (workspaceId: string, state?: ModelDecisionState, projectId?: string) =>
    ["model-registry", workspaceId, "decisions", state ?? null, projectId ?? null] as const,
  routes: (workspaceId: string, projectId?: string) =>
    ["model-registry", workspaceId, "routes", projectId ?? null] as const,
  health: (workspaceId: string, routeId: string) =>
    ["model-registry", workspaceId, "health", routeId] as const,
  suites: (workspaceId: string, projectId?: string) =>
    ["model-registry", workspaceId, "suites", projectId ?? null] as const,
  runs: (workspaceId: string, suiteId: string) =>
    ["model-registry", workspaceId, "runs", suiteId] as const,
  caseResults: (workspaceId: string, runId: string) =>
    ["model-registry", workspaceId, "case-results", runId] as const,
  builds: (workspaceId: string, projectId?: string) =>
    ["model-registry", workspaceId, "builds", projectId ?? null] as const,
  huggingFace: (workspaceId: string) =>
    ["model-registry", workspaceId, "connections", "huggingface"] as const,
};

function useInvalidateRegistry(workspaceId: string) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: modelRegistryKeys.all(workspaceId) });
}

export function useModelLibrary(workspaceId: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: modelRegistryKeys.library(workspaceId, projectId),
    queryFn: () => listModelLibrary(workspaceId, { projectId }),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: (query) =>
      query.state.data?.some(
        (entry) => entry.version.status === "importing" || entry.version.status === "inspecting",
      )
        ? POLL_MS
        : false,
  });
}

export function useModelSourceSearch(
  workspaceId: string,
  q: string,
  kind: ModelAssetKind,
  projectId?: string,
) {
  return useQuery({
    queryKey: modelRegistryKeys.sources(workspaceId, q, kind, projectId),
    queryFn: () => searchModelSources(workspaceId, { q, kind, projectId }),
    enabled: Boolean(workspaceId) && q.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useModelVersion(workspaceId: string, versionId: string, projectId?: string) {
  return useQuery({
    queryKey: modelRegistryKeys.version(workspaceId, versionId, projectId),
    queryFn: () => getModelVersion(workspaceId, versionId, projectId),
    enabled: Boolean(workspaceId && versionId),
    refetchInterval: (query) => {
      const detail = query.state.data;

      return detail &&
        (detail.version.status === "importing" ||
          detail.version.status === "inspecting" ||
          detail.evalRuns.some((run) => run.status === "queued" || run.status === "running"))
        ? POLL_MS
        : false;
    },
  });
}

export function useRouteSuggestions(workspaceId: string, versionId: string, enabled = true) {
  return useQuery({
    queryKey: modelRegistryKeys.suggestions(workspaceId, versionId),
    queryFn: () => listRouteSuggestions(workspaceId, versionId),
    enabled: enabled && Boolean(workspaceId && versionId),
  });
}

export function useModelPolicies(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: modelRegistryKeys.policies(workspaceId),
    queryFn: () => getModelPolicies(workspaceId),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useModelDecisions(
  workspaceId: string,
  state?: ModelDecisionState,
  projectId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: modelRegistryKeys.decisions(workspaceId, state, projectId),
    queryFn: () => listModelDecisions(workspaceId, { state, projectId }),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useModelRoutes(workspaceId: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: modelRegistryKeys.routes(workspaceId, projectId),
    queryFn: () => listModelRoutes(workspaceId, projectId),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useModelRouteHealth(workspaceId: string, routeId: string | undefined) {
  return useQuery({
    queryKey: modelRegistryKeys.health(workspaceId, routeId ?? ""),
    queryFn: () => getModelRouteHealth(workspaceId, routeId ?? ""),
    enabled: Boolean(workspaceId && routeId),
  });
}

export function useEvalSuites(workspaceId: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: modelRegistryKeys.suites(workspaceId, projectId),
    queryFn: () => listEvalSuites(workspaceId, projectId),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useEvalRuns(workspaceId: string, suiteId: string | undefined) {
  return useQuery({
    queryKey: modelRegistryKeys.runs(workspaceId, suiteId ?? ""),
    queryFn: () => listEvalRuns(workspaceId, suiteId ?? ""),
    enabled: Boolean(workspaceId && suiteId),
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "queued" || run.status === "running")
        ? POLL_MS
        : false,
  });
}

export function useEvalCaseResults(workspaceId: string, runId: string | undefined) {
  return useQuery({
    queryKey: modelRegistryKeys.caseResults(workspaceId, runId ?? ""),
    queryFn: () => listEvalCaseResults(workspaceId, runId ?? ""),
    enabled: Boolean(workspaceId && runId),
  });
}

export function useModelBuilds(workspaceId: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: modelRegistryKeys.builds(workspaceId, projectId),
    queryFn: () => listModelBuilds(workspaceId, projectId),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: (query) =>
      query.state.data?.some((build) => build.status === "running") ? POLL_MS * 3 : false,
  });
}

export function useHuggingFaceConnection(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: modelRegistryKeys.huggingFace(workspaceId),
    queryFn: () => getHuggingFaceConnection(workspaceId),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useHuggingFaceConnectionMutations(workspaceId: string) {
  const invalidate = useInvalidateRegistry(workspaceId);

  return {
    check: useMutation({
      mutationFn: (token?: string) => checkHuggingFaceToken(workspaceId, token),
    }),
    save: useMutation({
      mutationFn: (input: SaveHuggingFaceConnectionRequest) =>
        saveHuggingFaceConnection(workspaceId, input),
      onSuccess: invalidate,
    }),
    disconnect: useMutation({
      mutationFn: () => deleteHuggingFaceConnection(workspaceId),
      onSuccess: invalidate,
    }),
  };
}

export function useModelRegistryMutations(workspaceId: string) {
  const invalidate = useInvalidateRegistry(workspaceId);

  return {
    importAsset: useMutation({
      mutationFn: (input: ImportAssetRequest) => importModelAsset(workspaceId, input),
      onSuccess: invalidate,
    }),
    reinspect: useMutation({
      mutationFn: (versionId: string) => reinspectModelVersion(workspaceId, versionId),
      onSuccess: invalidate,
    }),
    requestDecision: useMutation({
      mutationFn: (input: RequestDecisionInput) => requestModelDecision(workspaceId, input),
      onSuccess: invalidate,
    }),
    resolveDecision: useMutation({
      mutationFn: ({ decisionId, input }: { decisionId: string; input: ResolveDecisionInput }) =>
        resolveModelDecision(workspaceId, decisionId, input),
      onSuccess: invalidate,
    }),
    savePolicy: useMutation({
      mutationFn: (input: UpsertPolicyRequest) => saveModelPolicy(workspaceId, input),
      onSuccess: invalidate,
    }),
    dryRunPolicy: useMutation({
      mutationFn: (input: PolicyDryRunRequest) => dryRunModelPolicy(workspaceId, input),
    }),
    createRoute: useMutation({
      mutationFn: (input: CreateRouteRequest) => createModelRoute(workspaceId, input),
      onSuccess: invalidate,
    }),
    retireRoute: useMutation({
      mutationFn: (routeId: string) => retireModelRoute(workspaceId, routeId),
      onSuccess: invalidate,
    }),
    deployVersion: useMutation({
      mutationFn: ({ versionId, input }: { versionId: string; input: DeployVersionRequest }) =>
        deployModelVersion(workspaceId, versionId, input),
      onSuccess: invalidate,
    }),
    exportBom: useMutation({
      mutationFn: ({ versionId, routeId }: { versionId: string; routeId?: string }) =>
        exportModelBom(workspaceId, versionId, routeId),
    }),
    createSuite: useMutation({
      mutationFn: (input: CreateEvalSuiteRequest) => createEvalSuite(workspaceId, input),
      onSuccess: invalidate,
    }),
    deleteSuite: useMutation({
      mutationFn: (suiteId: string) => deleteEvalSuite(workspaceId, suiteId),
      onSuccess: invalidate,
    }),
    startRuns: useMutation({
      mutationFn: ({ suiteId, routeIds }: { suiteId: string; routeIds: string[] }) =>
        startEvalRuns(workspaceId, suiteId, routeIds),
      onSuccess: invalidate,
    }),
    startBuild: useMutation({
      mutationFn: (input: StartBuildRequest) => startModelBuild(workspaceId, input),
      onSuccess: invalidate,
    }),
  };
}
