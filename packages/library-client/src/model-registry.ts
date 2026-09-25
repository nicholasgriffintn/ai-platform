import type {
  CreateEvalSuiteRequest,
  CreateRouteRequest,
  DecisionsResponse,
  DeployVersionRequest,
  EvalCaseResult,
  EvalRun,
  EvalSuite,
  HuggingFaceConnection,
  HuggingFaceTokenCheck,
  ImportAssetRequest,
  LibraryEntry,
  ModelAssetKind,
  ModelBuild,
  ModelDecision,
  ModelDecisionState,
  ModelPolicy,
  ModelRoute,
  PoliciesResponse,
  PolicyDryRunRequest,
  PolicyDryRunResult,
  RequestDecisionInput,
  ResolveDecisionInput,
  RouteHealth,
  RoutesResponse,
  RouteSuggestion,
  SaveHuggingFaceConnectionRequest,
  SourceSearchResult,
  StartBuildRequest,
  UpsertPolicyRequest,
  VersionDetail,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

async function request<T>(path: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const response = await fetchApiOrThrow(`/model-registry${path}`, {
    method: init.method ?? "GET",
    headers: await apiService.getHeaders(),
    body: init.body,
  });

  return returnFetchedData<T>(response);
}

function workspacePath(workspaceId: string, path = ""): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}${path}`;
}

export async function searchModelSources(
  workspaceId: string,
  params: { q: string; kind: ModelAssetKind; projectId?: string; limit?: number },
): Promise<SourceSearchResult[]> {
  return (
    await request<{ results: SourceSearchResult[] }>(
      workspacePath(workspaceId, `/sources${toQueryString(params)}`),
    )
  ).results;
}

export async function listModelLibrary(
  workspaceId: string,
  params: { kind?: ModelAssetKind; projectId?: string; approvedOnly?: boolean } = {},
): Promise<LibraryEntry[]> {
  return (
    await request<{ entries: LibraryEntry[] }>(
      workspacePath(workspaceId, `/library${toQueryString(params)}`),
    )
  ).entries;
}

export async function importModelAsset(
  workspaceId: string,
  input: ImportAssetRequest,
): Promise<VersionDetail> {
  return request(workspacePath(workspaceId, "/imports"), { method: "POST", body: input });
}

export async function getModelVersion(
  workspaceId: string,
  versionId: string,
  projectId?: string,
): Promise<VersionDetail> {
  return request(
    workspacePath(
      workspaceId,
      `/versions/${encodeURIComponent(versionId)}${toQueryString({ projectId })}`,
    ),
  );
}

export async function reinspectModelVersion(
  workspaceId: string,
  versionId: string,
): Promise<VersionDetail> {
  return request(
    workspacePath(workspaceId, `/versions/${encodeURIComponent(versionId)}/reinspect`),
    {
      method: "POST",
    },
  );
}

export async function exportModelBom(
  workspaceId: string,
  versionId: string,
  routeId?: string,
): Promise<Record<string, unknown>> {
  return request(
    workspacePath(
      workspaceId,
      `/versions/${encodeURIComponent(versionId)}/bom${toQueryString({ routeId })}`,
    ),
  );
}

export async function listRouteSuggestions(
  workspaceId: string,
  versionId: string,
): Promise<RouteSuggestion[]> {
  return (
    await request<{ suggestions: RouteSuggestion[] }>(
      workspacePath(workspaceId, `/versions/${encodeURIComponent(versionId)}/route-suggestions`),
    )
  ).suggestions;
}

export async function deployModelVersion(
  workspaceId: string,
  versionId: string,
  input: DeployVersionRequest,
): Promise<ModelRoute> {
  return request(workspacePath(workspaceId, `/versions/${encodeURIComponent(versionId)}/deploy`), {
    method: "POST",
    body: input,
  });
}

export async function getModelPolicies(workspaceId: string): Promise<PoliciesResponse> {
  return request(workspacePath(workspaceId, "/policies"));
}

export async function saveModelPolicy(
  workspaceId: string,
  input: UpsertPolicyRequest,
): Promise<ModelPolicy> {
  return request(workspacePath(workspaceId, "/policies"), { method: "PUT", body: input });
}

export async function dryRunModelPolicy(
  workspaceId: string,
  input: PolicyDryRunRequest,
): Promise<PolicyDryRunResult> {
  return request(workspacePath(workspaceId, "/policies/dry-run"), { method: "POST", body: input });
}

export async function listModelDecisions(
  workspaceId: string,
  params: { state?: ModelDecisionState; projectId?: string } = {},
): Promise<DecisionsResponse["decisions"]> {
  return (
    await request<DecisionsResponse>(
      workspacePath(workspaceId, `/decisions${toQueryString(params)}`),
    )
  ).decisions;
}

export async function requestModelDecision(
  workspaceId: string,
  input: RequestDecisionInput,
): Promise<ModelDecision> {
  return request(workspacePath(workspaceId, "/decisions"), { method: "POST", body: input });
}

export async function resolveModelDecision(
  workspaceId: string,
  decisionId: string,
  input: ResolveDecisionInput,
): Promise<ModelDecision> {
  return request(
    workspacePath(workspaceId, `/decisions/${encodeURIComponent(decisionId)}/resolve`),
    { method: "POST", body: input },
  );
}

export async function listModelRoutes(
  workspaceId: string,
  projectId?: string,
): Promise<RoutesResponse["routes"]> {
  return (
    await request<RoutesResponse>(
      workspacePath(workspaceId, `/routes${toQueryString({ projectId })}`),
    )
  ).routes;
}

export async function createModelRoute(
  workspaceId: string,
  input: CreateRouteRequest,
): Promise<ModelRoute> {
  return request(workspacePath(workspaceId, "/routes"), { method: "POST", body: input });
}

export async function retireModelRoute(workspaceId: string, routeId: string): Promise<ModelRoute> {
  return request(workspacePath(workspaceId, `/routes/${encodeURIComponent(routeId)}/retire`), {
    method: "POST",
  });
}

export async function getModelRouteHealth(
  workspaceId: string,
  routeId: string,
): Promise<RouteHealth> {
  return request(workspacePath(workspaceId, `/routes/${encodeURIComponent(routeId)}/health`));
}

export async function listEvalSuites(
  workspaceId: string,
  projectId?: string,
): Promise<EvalSuite[]> {
  return (
    await request<{ suites: EvalSuite[] }>(
      workspacePath(workspaceId, `/eval-suites${toQueryString({ projectId })}`),
    )
  ).suites;
}

export async function createEvalSuite(
  workspaceId: string,
  input: CreateEvalSuiteRequest,
): Promise<EvalSuite> {
  return request(workspacePath(workspaceId, "/eval-suites"), { method: "POST", body: input });
}

export async function deleteEvalSuite(workspaceId: string, suiteId: string): Promise<void> {
  await request(workspacePath(workspaceId, `/eval-suites/${encodeURIComponent(suiteId)}`), {
    method: "DELETE",
  });
}

export async function startEvalRuns(
  workspaceId: string,
  suiteId: string,
  routeIds: string[],
): Promise<EvalRun[]> {
  return (
    await request<{ runs: EvalRun[] }>(
      workspacePath(workspaceId, `/eval-suites/${encodeURIComponent(suiteId)}/runs`),
      { method: "POST", body: { routeIds } },
    )
  ).runs;
}

export async function listEvalRuns(workspaceId: string, suiteId: string): Promise<EvalRun[]> {
  return (
    await request<{ runs: EvalRun[] }>(
      workspacePath(workspaceId, `/eval-suites/${encodeURIComponent(suiteId)}/runs`),
    )
  ).runs;
}

export async function listEvalCaseResults(
  workspaceId: string,
  runId: string,
): Promise<EvalCaseResult[]> {
  return (
    await request<{ results: EvalCaseResult[] }>(
      workspacePath(workspaceId, `/eval-runs/${encodeURIComponent(runId)}/results`),
    )
  ).results;
}

export async function listModelBuilds(
  workspaceId: string,
  projectId?: string,
): Promise<ModelBuild[]> {
  return (
    await request<{ builds: ModelBuild[] }>(
      workspacePath(workspaceId, `/builds${toQueryString({ projectId })}`),
    )
  ).builds;
}

export async function startModelBuild(
  workspaceId: string,
  input: StartBuildRequest,
): Promise<ModelBuild> {
  return request(workspacePath(workspaceId, "/builds"), { method: "POST", body: input });
}

function huggingFacePath(workspaceId: string, path = ""): string {
  return workspacePath(workspaceId, `/connections/huggingface${path}`);
}

export async function getHuggingFaceConnection(
  workspaceId: string,
): Promise<HuggingFaceConnection> {
  return request(huggingFacePath(workspaceId));
}

export async function checkHuggingFaceToken(
  workspaceId: string,
  token?: string,
): Promise<HuggingFaceTokenCheck> {
  return request(huggingFacePath(workspaceId, "/check"), { method: "POST", body: { token } });
}

export async function saveHuggingFaceConnection(
  workspaceId: string,
  input: SaveHuggingFaceConnectionRequest,
): Promise<HuggingFaceConnection> {
  return request(huggingFacePath(workspaceId), { method: "PUT", body: input });
}

export async function deleteHuggingFaceConnection(
  workspaceId: string,
): Promise<HuggingFaceConnection> {
  return request(huggingFacePath(workspaceId), { method: "DELETE" });
}
