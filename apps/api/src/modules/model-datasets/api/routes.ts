import {
  createDatasetRequestSchema,
  datasetDetailSchema,
  datasetRowsQuerySchema,
  datasetRowsResponseSchema,
  datasetsResponseSchema,
  datasetSummarySchema,
  erasureRequestSchema,
  erasureResultSchema,
  excludeDatasetRowsRequestSchema,
  modelDatasetParamsSchema,
  modelUploadParamsSchema,
  registryProjectScopeQuerySchema,
  registryWorkspaceParamsSchema,
  uploadPreviewSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  createDataset,
  excludeDatasetRows,
  getDatasetDetail,
  listDatasets,
  previewUploadColumns,
  readDatasetRows,
  requestErasure,
} from "~/modules/model-datasets/application/datasets";

const app = new Hono();
const tags = ["model-datasets"];
const base = "/workspaces/:workspaceId";

addRoute(app, "get", `${base}/datasets`, {
  auth: true,
  tags,
  summary: "List governed datasets",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Datasets", schema: datasetsResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listDatasets(serviceContext, params.workspaceId, query.projectId),
});

addRoute(app, "post", `${base}/datasets`, {
  auth: true,
  tags,
  summary: "Build a dataset from an upload, the Hub, a bucket, conversations or a teacher model",
  description:
    "Queues canonicalisation, deduplication, decontamination, redaction and deterministic splits.",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createDatasetRequestSchema,
  responses: { 200: { description: "Dataset", schema: datasetSummarySchema } },
  handler: ({ serviceContext, params, body }) =>
    createDataset(serviceContext, params.workspaceId, body),
});

addRoute(app, "get", `${base}/uploads/:uploadId/preview`, {
  auth: true,
  tags,
  summary: "Preview columns and a suggested mapping for an uploaded dataset file",
  paramSchema: modelUploadParamsSchema,
  responses: { 200: { description: "Preview", schema: uploadPreviewSchema } },
  handler: ({ serviceContext, params }) =>
    previewUploadColumns(serviceContext, params.workspaceId, params.uploadId),
});

addRoute(app, "get", `${base}/datasets/:versionId`, {
  auth: true,
  tags,
  summary: "Get a dataset with its profile, governance and lineage",
  paramSchema: modelDatasetParamsSchema,
  responses: { 200: { description: "Dataset", schema: datasetDetailSchema } },
  handler: ({ serviceContext, params }) =>
    getDatasetDetail(serviceContext, params.workspaceId, params.versionId),
});

addRoute(app, "get", `${base}/datasets/:versionId/rows`, {
  auth: true,
  tags,
  summary: "Page through processed rows",
  paramSchema: modelDatasetParamsSchema,
  querySchema: datasetRowsQuerySchema,
  responses: { 200: { description: "Rows", schema: datasetRowsResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    readDatasetRows(serviceContext, params.workspaceId, params.versionId, query),
});

addRoute(app, "post", `${base}/datasets/:versionId/exclusions`, {
  auth: true,
  tags,
  summary: "Exclude rows and cut a new revision",
  paramSchema: modelDatasetParamsSchema,
  bodySchema: excludeDatasetRowsRequestSchema,
  responses: { 200: { description: "Dataset", schema: datasetSummarySchema } },
  handler: ({ serviceContext, params, body }) =>
    excludeDatasetRows(serviceContext, params.workspaceId, params.versionId, body),
});

addRoute(app, "post", `${base}/datasets/:versionId/erasure`, {
  auth: true,
  tags,
  summary: "Record an erasure request and flag models trained on the affected rows",
  paramSchema: modelDatasetParamsSchema,
  bodySchema: erasureRequestSchema,
  responses: { 200: { description: "Erasure result", schema: erasureResultSchema } },
  handler: ({ serviceContext, params, body }) =>
    requestErasure(serviceContext, params.workspaceId, params.versionId, body),
});

export default app;
