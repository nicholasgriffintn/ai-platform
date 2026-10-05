import {
  cancelTrainingRun,
  changeDeploymentState,
  checkModelProvider,
  createAlias,
  createDataset,
  createDeployment,
  createEvalSuite,
  createGrader,
  createModelRoute,
  deleteAlias,
  deleteEvalSuite,
  deleteGrader,
  deleteModelBudget,
  deleteModelProvider,
  dryRunModelPolicy,
  excludeDatasetRows,
  exportModelBom,
  exportModelCard,
  exportModelInventory,
  exportTrainingContentSummary,
  getAlias,
  getDataset,
  getDeployment,
  getModelPermissions,
  getModelPolicies,
  getModelRouteHealth,
  getModelSpend,
  getModelsOverview,
  getModelVersion,
  getMyModelPermissions,
  getTrainingRun,
  importBucketModel,
  importModelAsset,
  listAliases,
  listDatasetRows,
  listDatasets,
  listDeployments,
  listEvalCaseResults,
  listEvalRuns,
  listEvalSuites,
  listGraders,
  listModelAudit,
  listModelDecisions,
  listModelLibrary,
  listModelProviders,
  listModelRoutes,
  listRouteSuggestions,
  listSpendRequests,
  listTrainingRuns,
  planDeployment,
  planTraining,
  previewDatasetUpload,
  previewGrader,
  promoteAlias,
  recommendTraining,
  registerUploadedModel,
  reinspectModelVersion,
  requestDatasetErasure,
  requestModelDecision,
  resolveModelDecision,
  resolveSpendRequest,
  retireModelRoute,
  revokeModelVersion,
  rollbackAlias,
  runDeploymentPlayground,
  saveModelBudget,
  saveModelPermissions,
  saveModelPolicy,
  saveModelProvider,
  scaleDeployment,
  searchModelSources,
  startEvalRuns,
  startTrainingRun,
  updateAlias,
  updateGrader,
} from "@ngriffin_uk/polychat-library-client";
import {
  ACTIVE_TRAINING_RUN_STATUSES,
  type BomFormat,
  type CreateAliasRequest,
  type CreateDatasetRequest,
  type CreateDeploymentRequest,
  type CreateEvalSuiteRequest,
  type CreateGraderRequest,
  type CreateRouteRequest,
  type DatasetSplit,
  type DeploymentAction,
  type DeploymentPlanRequest,
  type DeploymentStatus,
  type ErasureRequest,
  type ExcludeDatasetRowsRequest,
  type ImportAssetRequest,
  type ImportBucketModelRequest,
  type ModelAssetKind,
  type ModelAuditQuery,
  type ModelDecisionState,
  type ModelProviderId,
  type PlaygroundRequest,
  type PolicyDryRunRequest,
  type PromoteAliasRequest,
  type RegisterUploadedModelRequest,
  type RequestDecisionInput,
  type ResolveDecisionInput,
  type ResolveSpendRequest,
  type RevokeVersionRequest,
  type SaveBudgetRequest,
  type SaveModelConnectionRequest,
  type SaveModelPermissionsRequest,
  type ScaleDeploymentRequest,
  type StartTrainingRunRequest,
  TRANSITIONAL_DEPLOYMENT_STATUSES,
  type TrainingPlanRequest,
  type TrainingRecommendationRequest,
  type TrainingRunStatus,
  type UpdateAliasRequest,
  type UpsertPolicyRequest,
} from "@ngriffin_uk/polychat-schemas";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";

const POLL_MS = 10_000;
const SLOW_POLL_MS = 30_000;

type ScopeKey = string | null;

export const modelPlatformKeys = {
  all: (workspaceId: string) => ["model-platform", workspaceId] as const,
  overview: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "overview", projectId ?? null] as const,
  library: (workspaceId: string, kind?: ModelAssetKind, projectId?: string) =>
    ["model-platform", workspaceId, "library", kind ?? null, projectId ?? null] as const,
  sources: (workspaceId: string, q: string, kind: ModelAssetKind, projectId?: string) =>
    ["model-platform", workspaceId, "sources", q, kind, projectId ?? null] as const,
  version: (workspaceId: string, versionId: string, projectId?: string) =>
    ["model-platform", workspaceId, "version", versionId, projectId ?? null] as const,
  datasets: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "datasets", projectId ?? null] as const,
  dataset: (workspaceId: string, versionId: string) =>
    ["model-platform", workspaceId, "dataset", versionId] as const,
  datasetRows: (
    workspaceId: string,
    versionId: string,
    split: DatasetSplit,
    offset: number,
    flaggedOnly: boolean,
  ) =>
    ["model-platform", workspaceId, "dataset-rows", versionId, split, offset, flaggedOnly] as const,
  uploadPreview: (workspaceId: string, uploadId: string) =>
    ["model-platform", workspaceId, "upload-preview", uploadId] as const,
  runs: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "runs", projectId ?? null] as const,
  run: (workspaceId: string, runId: string) =>
    ["model-platform", workspaceId, "run", runId] as const,
  deployments: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "deployments", projectId ?? null] as const,
  deployment: (workspaceId: string, deploymentId: string) =>
    ["model-platform", workspaceId, "deployment", deploymentId] as const,
  aliases: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "aliases", projectId ?? null] as const,
  alias: (workspaceId: string, aliasId: string) =>
    ["model-platform", workspaceId, "alias", aliasId] as const,
  routes: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "routes", projectId ?? null] as const,
  health: (workspaceId: string, routeId: string) =>
    ["model-platform", workspaceId, "health", routeId] as const,
  suggestions: (workspaceId: string, versionId: string) =>
    ["model-platform", workspaceId, "suggestions", versionId] as const,
  graders: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "graders", projectId ?? null] as const,
  suites: (workspaceId: string, projectId?: string) =>
    ["model-platform", workspaceId, "suites", projectId ?? null] as const,
  evalRuns: (workspaceId: string, suiteId: string) =>
    ["model-platform", workspaceId, "eval-runs", suiteId] as const,
  caseResults: (workspaceId: string, runId: string) =>
    ["model-platform", workspaceId, "case-results", runId] as const,
  policies: (workspaceId: string) => ["model-platform", workspaceId, "policies"] as const,
  decisions: (workspaceId: string, state?: ModelDecisionState, projectId?: string) =>
    ["model-platform", workspaceId, "decisions", state ?? null, projectId ?? null] as const,
  providers: (workspaceId: string) => ["model-platform", workspaceId, "providers"] as const,
  permissions: (workspaceId: string) => ["model-platform", workspaceId, "permissions"] as const,
  myPermissions: (workspaceId: string) =>
    ["model-platform", workspaceId, "permissions", "me"] as const,
  spend: (workspaceId: string) => ["model-platform", workspaceId, "spend"] as const,
  spendRequests: (workspaceId: string) =>
    ["model-platform", workspaceId, "spend-requests"] as const,
  audit: (workspaceId: string, targetType: ScopeKey, targetId: ScopeKey) =>
    ["model-platform", workspaceId, "audit", targetType, targetId] as const,
};

function isActiveRun(status: TrainingRunStatus): boolean {
  return ACTIVE_TRAINING_RUN_STATUSES.includes(status);
}

function isTransitional(status: DeploymentStatus): boolean {
  return TRANSITIONAL_DEPLOYMENT_STATUSES.includes(status);
}

function usePlatformMutation<TInput, TResult>(
  workspaceId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: modelPlatformKeys.all(workspaceId) }),
  });
}

export function useModelsOverview(workspaceId: string, projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.overview(workspaceId, projectId),
    queryFn: () => getModelsOverview(workspaceId, projectId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) => {
          const data = currentQuery.state.data;

          return data &&
            (data.runs.some((run) => isActiveRun(run.status)) ||
              data.deployments.some((deployment) => isTransitional(deployment.status)))
            ? POLL_MS
            : SLOW_POLL_MS;
        },
        "model_platform.changed",
        SLOW_POLL_MS,
      ),
  });
}

export function useModelLibrary(workspaceId: string, kind?: ModelAssetKind, projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.library(workspaceId, kind, projectId),
    queryFn: () => listModelLibrary(workspaceId, { kind, projectId }),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data?.some(
            (entry) =>
              entry.version.status === "importing" || entry.version.status === "inspecting",
          )
            ? POLL_MS
            : false,
        "model_platform.changed",
      ),
  });
}

export function useModelSourceSearch(
  workspaceId: string,
  q: string,
  kind: ModelAssetKind,
  projectId?: string,
) {
  return useQuery({
    queryKey: modelPlatformKeys.sources(workspaceId, q, kind, projectId),
    queryFn: () => searchModelSources(workspaceId, { q, kind, projectId }),
    enabled: Boolean(workspaceId) && q.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useModelVersion(workspaceId: string, versionId: string, projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.version(workspaceId, versionId, projectId),
    queryFn: () => getModelVersion(workspaceId, versionId, projectId),
    enabled: Boolean(workspaceId && versionId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) => {
          const detail = currentQuery.state.data;

          return detail &&
            (detail.version.status === "importing" ||
              detail.version.status === "inspecting" ||
              detail.evalRuns.some((run) => run.status === "queued" || run.status === "running"))
            ? POLL_MS
            : false;
        },
        "model_platform.changed",
      ),
  });
}

export function useDatasets(workspaceId: string, projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.datasets(workspaceId, projectId),
    queryFn: () => listDatasets(workspaceId, projectId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data?.some((dataset) => dataset.profile?.status === "processing")
            ? POLL_MS
            : false,
        "model_platform.changed",
      ),
  });
}

export function useDataset(workspaceId: string, versionId: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.dataset(workspaceId, versionId),
    queryFn: () => getDataset(workspaceId, versionId),
    enabled: Boolean(workspaceId && versionId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data?.profile?.status === "processing" ? POLL_MS : false,
        "model_platform.changed",
      ),
  });
}

export function useDatasetRows(
  workspaceId: string,
  versionId: string,
  params: { split: DatasetSplit; offset: number; limit: number; flaggedOnly: boolean },
  enabled = true,
) {
  return useQuery({
    queryKey: modelPlatformKeys.datasetRows(
      workspaceId,
      versionId,
      params.split,
      params.offset,
      params.flaggedOnly,
    ),
    queryFn: () => listDatasetRows(workspaceId, versionId, params),
    enabled: enabled && Boolean(workspaceId && versionId),
  });
}

export function useUploadPreview(workspaceId: string, uploadId: string | undefined) {
  return useQuery({
    queryKey: modelPlatformKeys.uploadPreview(workspaceId, uploadId ?? ""),
    queryFn: () => previewDatasetUpload(workspaceId, uploadId ?? ""),
    enabled: Boolean(workspaceId && uploadId),
  });
}

export function useTrainingRuns(workspaceId: string, projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.runs(workspaceId, projectId),
    queryFn: () => listTrainingRuns(workspaceId, projectId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data?.some((run) => isActiveRun(run.status)) ? POLL_MS : false,
        "model_platform.changed",
        SLOW_POLL_MS,
      ),
  });
}

export function useTrainingRun(workspaceId: string, runId: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.run(workspaceId, runId),
    queryFn: () => getTrainingRun(workspaceId, runId),
    enabled: Boolean(workspaceId && runId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data && isActiveRun(currentQuery.state.data.status) ? POLL_MS : false,
        "model_platform.changed",
        SLOW_POLL_MS,
      ),
  });
}

export function useTrainingPlan(workspaceId: string, request: TrainingPlanRequest | null) {
  return useQuery({
    queryKey: ["model-platform", workspaceId, "training-plan", request] as const,
    queryFn: workspaceId && request ? () => planTraining(workspaceId, request) : skipToken,
    staleTime: 60_000,
  });
}

export function useDeploymentPlan(workspaceId: string, request: DeploymentPlanRequest | null) {
  return useQuery({
    queryKey: ["model-platform", workspaceId, "deployment-plan", request] as const,
    queryFn: workspaceId && request ? () => planDeployment(workspaceId, request) : skipToken,
    staleTime: 60_000,
  });
}

export function useDeployments(workspaceId: string, projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.deployments(workspaceId, projectId),
    queryFn: () => listDeployments(workspaceId, projectId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data?.some((deployment) => isTransitional(deployment.status))
            ? POLL_MS
            : SLOW_POLL_MS,
        "model_platform.changed",
        SLOW_POLL_MS,
      ),
  });
}

export function useDeployment(workspaceId: string, deploymentId: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.deployment(workspaceId, deploymentId),
    queryFn: () => getDeployment(workspaceId, deploymentId),
    enabled: Boolean(workspaceId && deploymentId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data && isTransitional(currentQuery.state.data.deployment.status)
            ? POLL_MS
            : SLOW_POLL_MS,
        "model_platform.changed",
        SLOW_POLL_MS,
      ),
  });
}

export function useAliases(workspaceId: string, projectId?: string) {
  return useQuery({
    queryKey: modelPlatformKeys.aliases(workspaceId, projectId),
    queryFn: () => listAliases(workspaceId, projectId),
    enabled: Boolean(workspaceId),
  });
}

export function useAlias(workspaceId: string, aliasId: string) {
  return useQuery({
    queryKey: modelPlatformKeys.alias(workspaceId, aliasId),
    queryFn: () => getAlias(workspaceId, aliasId),
    enabled: Boolean(workspaceId && aliasId),
  });
}

export function useModelRoutes(workspaceId: string, projectId?: string) {
  return useQuery({
    queryKey: modelPlatformKeys.routes(workspaceId, projectId),
    queryFn: () => listModelRoutes(workspaceId, projectId),
    enabled: Boolean(workspaceId),
  });
}

export function useModelRouteHealth(workspaceId: string, routeId: string | undefined) {
  return useQuery({
    queryKey: modelPlatformKeys.health(workspaceId, routeId ?? ""),
    queryFn: () => getModelRouteHealth(workspaceId, routeId ?? ""),
    enabled: Boolean(workspaceId && routeId),
  });
}

export function useRouteSuggestions(workspaceId: string, versionId: string, enabled = true) {
  return useQuery({
    queryKey: modelPlatformKeys.suggestions(workspaceId, versionId),
    queryFn: () => listRouteSuggestions(workspaceId, versionId),
    enabled: enabled && Boolean(workspaceId && versionId),
  });
}

export function useGraders(workspaceId: string, projectId?: string) {
  return useQuery({
    queryKey: modelPlatformKeys.graders(workspaceId, projectId),
    queryFn: () => listGraders(workspaceId, projectId),
    enabled: Boolean(workspaceId),
  });
}

export function useEvalSuites(workspaceId: string, projectId?: string) {
  return useQuery({
    queryKey: modelPlatformKeys.suites(workspaceId, projectId),
    queryFn: () => listEvalSuites(workspaceId, projectId),
    enabled: Boolean(workspaceId),
  });
}

export function useEvalRuns(workspaceId: string, suiteId: string | undefined) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: modelPlatformKeys.evalRuns(workspaceId, suiteId ?? ""),
    queryFn: () => listEvalRuns(workspaceId, suiteId ?? ""),
    enabled: Boolean(workspaceId && suiteId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) =>
          currentQuery.state.data?.some(
            (run) => run.status === "queued" || run.status === "running",
          )
            ? POLL_MS
            : false,
        "model_platform.changed",
      ),
  });
}

export function useEvalCaseResults(workspaceId: string, runId: string | undefined) {
  return useQuery({
    queryKey: modelPlatformKeys.caseResults(workspaceId, runId ?? ""),
    queryFn: () => listEvalCaseResults(workspaceId, runId ?? ""),
    enabled: Boolean(workspaceId && runId),
  });
}

export function useModelPolicies(workspaceId: string) {
  return useQuery({
    queryKey: modelPlatformKeys.policies(workspaceId),
    queryFn: () => getModelPolicies(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useModelDecisions(
  workspaceId: string,
  state?: ModelDecisionState,
  projectId?: string,
) {
  return useQuery({
    queryKey: modelPlatformKeys.decisions(workspaceId, state, projectId),
    queryFn: () => listModelDecisions(workspaceId, { state, projectId }),
    enabled: Boolean(workspaceId),
  });
}

export function useModelProviders(workspaceId: string) {
  return useQuery({
    queryKey: modelPlatformKeys.providers(workspaceId),
    queryFn: () => listModelProviders(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

export function useModelPermissions(workspaceId: string) {
  return useQuery({
    queryKey: modelPlatformKeys.permissions(workspaceId),
    queryFn: () => getModelPermissions(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useMyModelPermissions(workspaceId: string) {
  return useQuery({
    queryKey: modelPlatformKeys.myPermissions(workspaceId),
    queryFn: () => getMyModelPermissions(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

export function useModelSpend(workspaceId: string) {
  return useQuery({
    queryKey: modelPlatformKeys.spend(workspaceId),
    queryFn: () => getModelSpend(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useSpendRequests(workspaceId: string) {
  return useQuery({
    queryKey: modelPlatformKeys.spendRequests(workspaceId),
    queryFn: () => listSpendRequests(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useModelAudit(workspaceId: string, params: Partial<ModelAuditQuery> = {}) {
  return useQuery({
    queryKey: modelPlatformKeys.audit(
      workspaceId,
      params.targetType ?? null,
      params.targetId ?? null,
    ),
    queryFn: () => listModelAudit(workspaceId, params),
    enabled: Boolean(workspaceId),
  });
}

export function useModelPlatformMutations(workspaceId: string) {
  return {
    importAsset: usePlatformMutation(workspaceId, (input: ImportAssetRequest) =>
      importModelAsset(workspaceId, input),
    ),
    importBucket: usePlatformMutation(workspaceId, (input: ImportBucketModelRequest) =>
      importBucketModel(workspaceId, input),
    ),
    registerUpload: usePlatformMutation(workspaceId, (input: RegisterUploadedModelRequest) =>
      registerUploadedModel(workspaceId, input),
    ),
    reinspect: usePlatformMutation(workspaceId, (versionId: string) =>
      reinspectModelVersion(workspaceId, versionId),
    ),
    createDataset: usePlatformMutation(workspaceId, (input: CreateDatasetRequest) =>
      createDataset(workspaceId, input),
    ),
    excludeRows: usePlatformMutation(
      workspaceId,
      ({ versionId, input }: { versionId: string; input: ExcludeDatasetRowsRequest }) =>
        excludeDatasetRows(workspaceId, versionId, input),
    ),
    requestErasure: usePlatformMutation(
      workspaceId,
      ({ versionId, input }: { versionId: string; input: ErasureRequest }) =>
        requestDatasetErasure(workspaceId, versionId, input),
    ),
    recommendTraining: useMutation({
      mutationFn: (input: TrainingRecommendationRequest) => recommendTraining(workspaceId, input),
    }),
    startRun: usePlatformMutation(workspaceId, (input: StartTrainingRunRequest) =>
      startTrainingRun(workspaceId, input),
    ),
    cancelRun: usePlatformMutation(workspaceId, (runId: string) =>
      cancelTrainingRun(workspaceId, runId),
    ),
    createDeployment: usePlatformMutation(workspaceId, (input: CreateDeploymentRequest) =>
      createDeployment(workspaceId, input),
    ),
    scaleDeployment: usePlatformMutation(
      workspaceId,
      ({ deploymentId, input }: { deploymentId: string; input: ScaleDeploymentRequest }) =>
        scaleDeployment(workspaceId, deploymentId, input),
    ),
    changeDeployment: usePlatformMutation(
      workspaceId,
      ({ deploymentId, action }: { deploymentId: string; action: DeploymentAction }) =>
        changeDeploymentState(workspaceId, deploymentId, action),
    ),
    playground: useMutation({
      mutationFn: ({ deploymentId, input }: { deploymentId: string; input: PlaygroundRequest }) =>
        runDeploymentPlayground(workspaceId, deploymentId, input),
    }),
    createAlias: usePlatformMutation(workspaceId, (input: CreateAliasRequest) =>
      createAlias(workspaceId, input),
    ),
    updateAlias: usePlatformMutation(
      workspaceId,
      ({ aliasId, input }: { aliasId: string; input: UpdateAliasRequest }) =>
        updateAlias(workspaceId, aliasId, input),
    ),
    deleteAlias: usePlatformMutation(workspaceId, (aliasId: string) =>
      deleteAlias(workspaceId, aliasId),
    ),
    promoteAlias: usePlatformMutation(
      workspaceId,
      ({ aliasId, input }: { aliasId: string; input: PromoteAliasRequest }) =>
        promoteAlias(workspaceId, aliasId, input),
    ),
    rollbackAlias: usePlatformMutation(workspaceId, (aliasId: string) =>
      rollbackAlias(workspaceId, aliasId),
    ),
    createRoute: usePlatformMutation(workspaceId, (input: CreateRouteRequest) =>
      createModelRoute(workspaceId, input),
    ),
    retireRoute: usePlatformMutation(workspaceId, (routeId: string) =>
      retireModelRoute(workspaceId, routeId),
    ),
    createGrader: usePlatformMutation(workspaceId, (input: CreateGraderRequest) =>
      createGrader(workspaceId, input),
    ),
    updateGrader: usePlatformMutation(
      workspaceId,
      ({ graderId, input }: { graderId: string; input: CreateGraderRequest }) =>
        updateGrader(workspaceId, graderId, input),
    ),
    deleteGrader: usePlatformMutation(workspaceId, (graderId: string) =>
      deleteGrader(workspaceId, graderId),
    ),
    previewGrader: useMutation({
      mutationFn: ({
        graderId,
        output,
        expected,
      }: {
        graderId: string;
        output: string;
        expected?: string;
      }) => previewGrader(workspaceId, graderId, { output, expected }),
    }),
    createSuite: usePlatformMutation(workspaceId, (input: CreateEvalSuiteRequest) =>
      createEvalSuite(workspaceId, input),
    ),
    deleteSuite: usePlatformMutation(workspaceId, (suiteId: string) =>
      deleteEvalSuite(workspaceId, suiteId),
    ),
    startEvalRuns: usePlatformMutation(
      workspaceId,
      ({ suiteId, routeIds }: { suiteId: string; routeIds: string[] }) =>
        startEvalRuns(workspaceId, suiteId, routeIds),
    ),
    savePolicy: usePlatformMutation(workspaceId, (input: UpsertPolicyRequest) =>
      saveModelPolicy(workspaceId, input),
    ),
    dryRunPolicy: useMutation({
      mutationFn: (input: PolicyDryRunRequest) => dryRunModelPolicy(workspaceId, input),
    }),
    requestDecision: usePlatformMutation(workspaceId, (input: RequestDecisionInput) =>
      requestModelDecision(workspaceId, input),
    ),
    resolveDecision: usePlatformMutation(
      workspaceId,
      ({ decisionId, input }: { decisionId: string; input: ResolveDecisionInput }) =>
        resolveModelDecision(workspaceId, decisionId, input),
    ),
    checkProvider: useMutation({
      mutationFn: ({
        provider,
        input,
      }: {
        provider: ModelProviderId;
        input: SaveModelConnectionRequest;
      }) => checkModelProvider(workspaceId, provider, input),
    }),
    saveProvider: usePlatformMutation(
      workspaceId,
      ({ provider, input }: { provider: ModelProviderId; input: SaveModelConnectionRequest }) =>
        saveModelProvider(workspaceId, provider, input),
    ),
    deleteProvider: usePlatformMutation(workspaceId, (provider: ModelProviderId) =>
      deleteModelProvider(workspaceId, provider),
    ),
    savePermissions: usePlatformMutation(workspaceId, (input: SaveModelPermissionsRequest) =>
      saveModelPermissions(workspaceId, input),
    ),
    saveBudget: usePlatformMutation(workspaceId, (input: SaveBudgetRequest) =>
      saveModelBudget(workspaceId, input),
    ),
    deleteBudget: usePlatformMutation(workspaceId, (projectId: string | undefined) =>
      deleteModelBudget(workspaceId, projectId),
    ),
    resolveSpend: usePlatformMutation(
      workspaceId,
      ({ requestId, input }: { requestId: string; input: ResolveSpendRequest }) =>
        resolveSpendRequest(workspaceId, requestId, input),
    ),
    revokeVersion: usePlatformMutation(
      workspaceId,
      ({ versionId, input }: { versionId: string; input: RevokeVersionRequest }) =>
        revokeModelVersion(workspaceId, versionId, input),
    ),
    exportBom: useMutation({
      mutationFn: ({
        versionId,
        format,
        routeId,
      }: {
        versionId: string;
        format: BomFormat;
        routeId?: string;
      }) => exportModelBom(workspaceId, versionId, { format, routeId }),
    }),
    exportCard: useMutation({
      mutationFn: (versionId: string) => exportModelCard(workspaceId, versionId),
    }),
    exportTrainingContent: useMutation({
      mutationFn: (versionId: string) => exportTrainingContentSummary(workspaceId, versionId),
    }),
    exportInventory: useMutation({ mutationFn: () => exportModelInventory(workspaceId) }),
  };
}
