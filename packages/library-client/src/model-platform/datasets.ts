import type {
  CreateDatasetRequest,
  DatasetDetail,
  DatasetRowsResponse,
  DatasetSplit,
  DatasetSummary,
  ErasureRequest,
  ErasureResult,
  ExcludeDatasetRowsRequest,
  UploadPreview,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { platformRequest, segment, workspacePath } from "./request.js";

export async function listDatasets(
  workspaceId: string,
  projectId?: string,
): Promise<DatasetSummary[]> {
  return (
    await platformRequest<{ datasets: DatasetSummary[] }>(
      workspacePath(workspaceId, `/datasets${toQueryString({ projectId })}`),
    )
  ).datasets;
}

export function createDataset(
  workspaceId: string,
  input: CreateDatasetRequest,
): Promise<DatasetSummary> {
  return platformRequest(workspacePath(workspaceId, "/datasets"), { method: "POST", body: input });
}

export function getDataset(workspaceId: string, versionId: string): Promise<DatasetDetail> {
  return platformRequest(workspacePath(workspaceId, `/datasets/${segment(versionId)}`));
}

export function listDatasetRows(
  workspaceId: string,
  versionId: string,
  params: { split: DatasetSplit; offset: number; limit: number; flaggedOnly: boolean },
): Promise<DatasetRowsResponse> {
  return platformRequest(
    workspacePath(
      workspaceId,
      `/datasets/${segment(versionId)}/rows${toQueryString({
        ...params,
        flaggedOnly: params.flaggedOnly ? "true" : "false",
      })}`,
    ),
  );
}

export function excludeDatasetRows(
  workspaceId: string,
  versionId: string,
  input: ExcludeDatasetRowsRequest,
): Promise<DatasetSummary> {
  return platformRequest(workspacePath(workspaceId, `/datasets/${segment(versionId)}/exclusions`), {
    method: "POST",
    body: input,
  });
}

export function requestDatasetErasure(
  workspaceId: string,
  versionId: string,
  input: ErasureRequest,
): Promise<ErasureResult> {
  return platformRequest(workspacePath(workspaceId, `/datasets/${segment(versionId)}/erasure`), {
    method: "POST",
    body: input,
  });
}

export function previewDatasetUpload(
  workspaceId: string,
  uploadId: string,
): Promise<UploadPreview> {
  return platformRequest(workspacePath(workspaceId, `/uploads/${segment(uploadId)}/preview`));
}
