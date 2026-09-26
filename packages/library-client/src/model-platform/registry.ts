import type {
  CreateUploadRequest,
  DecisionsResponse,
  ImportAssetRequest,
  ImportBucketModelRequest,
  LibraryEntry,
  ModelAssetKind,
  ModelDecision,
  ModelDecisionState,
  ModelPolicy,
  PoliciesResponse,
  PolicyDryRunRequest,
  PolicyDryRunResult,
  RegisterUploadedModelRequest,
  RequestDecisionInput,
  ResolveDecisionInput,
  SourceSearchResult,
  UploadSession,
  UpsertPolicyRequest,
  VersionDetail,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { platformRequest, segment, workspacePath } from "./request.js";

export async function searchModelSources(
  workspaceId: string,
  params: { q: string; kind: ModelAssetKind; projectId?: string; limit?: number },
): Promise<SourceSearchResult[]> {
  return (
    await platformRequest<{ results: SourceSearchResult[] }>(
      workspacePath(workspaceId, `/sources${toQueryString(params)}`),
    )
  ).results;
}

export async function listModelLibrary(
  workspaceId: string,
  params: { kind?: ModelAssetKind; projectId?: string; approvedOnly?: boolean } = {},
): Promise<LibraryEntry[]> {
  return (
    await platformRequest<{ entries: LibraryEntry[] }>(
      workspacePath(workspaceId, `/library${toQueryString(params)}`),
    )
  ).entries;
}

export function importModelAsset(
  workspaceId: string,
  input: ImportAssetRequest,
): Promise<VersionDetail> {
  return platformRequest(workspacePath(workspaceId, "/imports"), { method: "POST", body: input });
}

export function importBucketModel(
  workspaceId: string,
  input: ImportBucketModelRequest,
): Promise<VersionDetail> {
  return platformRequest(workspacePath(workspaceId, "/imports/bucket"), {
    method: "POST",
    body: input,
  });
}

export function createModelUpload(
  workspaceId: string,
  input: CreateUploadRequest,
): Promise<UploadSession> {
  return platformRequest(workspacePath(workspaceId, "/uploads"), { method: "POST", body: input });
}

export function getModelUpload(workspaceId: string, uploadId: string): Promise<UploadSession> {
  return platformRequest(workspacePath(workspaceId, `/uploads/${segment(uploadId)}`));
}

export function uploadModelPart(
  workspaceId: string,
  uploadId: string,
  fileIndex: number,
  partNumber: number,
  bytes: Blob,
): Promise<{ partNumber: number; etag: string }> {
  return platformRequest(
    workspacePath(
      workspaceId,
      `/uploads/${segment(uploadId)}/files/${fileIndex}/parts/${partNumber}`,
    ),
    { method: "PUT", body: bytes, contentType: "application/octet-stream" },
  );
}

export function completeModelUpload(workspaceId: string, uploadId: string): Promise<UploadSession> {
  return platformRequest(workspacePath(workspaceId, `/uploads/${segment(uploadId)}/complete`), {
    method: "POST",
  });
}

export function abortModelUpload(workspaceId: string, uploadId: string): Promise<UploadSession> {
  return platformRequest(workspacePath(workspaceId, `/uploads/${segment(uploadId)}/abort`), {
    method: "POST",
  });
}

export function registerUploadedModel(
  workspaceId: string,
  input: RegisterUploadedModelRequest,
): Promise<VersionDetail> {
  return platformRequest(workspacePath(workspaceId, "/uploads/register"), {
    method: "POST",
    body: input,
  });
}

export function getModelVersion(
  workspaceId: string,
  versionId: string,
  projectId?: string,
): Promise<VersionDetail> {
  return platformRequest(
    workspacePath(workspaceId, `/versions/${segment(versionId)}${toQueryString({ projectId })}`),
  );
}

export function reinspectModelVersion(
  workspaceId: string,
  versionId: string,
): Promise<VersionDetail> {
  return platformRequest(workspacePath(workspaceId, `/versions/${segment(versionId)}/reinspect`), {
    method: "POST",
  });
}

export function getModelPolicies(workspaceId: string): Promise<PoliciesResponse> {
  return platformRequest(workspacePath(workspaceId, "/policies"));
}

export function saveModelPolicy(
  workspaceId: string,
  input: UpsertPolicyRequest,
): Promise<ModelPolicy> {
  return platformRequest(workspacePath(workspaceId, "/policies"), { method: "PUT", body: input });
}

export function dryRunModelPolicy(
  workspaceId: string,
  input: PolicyDryRunRequest,
): Promise<PolicyDryRunResult> {
  return platformRequest(workspacePath(workspaceId, "/policies/dry-run"), {
    method: "POST",
    body: input,
  });
}

export async function listModelDecisions(
  workspaceId: string,
  params: { state?: ModelDecisionState; projectId?: string } = {},
): Promise<DecisionsResponse["decisions"]> {
  return (
    await platformRequest<DecisionsResponse>(
      workspacePath(workspaceId, `/decisions${toQueryString(params)}`),
    )
  ).decisions;
}

export function requestModelDecision(
  workspaceId: string,
  input: RequestDecisionInput,
): Promise<ModelDecision> {
  return platformRequest(workspacePath(workspaceId, "/decisions"), { method: "POST", body: input });
}

export function resolveModelDecision(
  workspaceId: string,
  decisionId: string,
  input: ResolveDecisionInput,
): Promise<ModelDecision> {
  return platformRequest(workspacePath(workspaceId, `/decisions/${segment(decisionId)}/resolve`), {
    method: "POST",
    body: input,
  });
}
