import {
  createUploadRequestSchema,
  decisionListQuerySchema,
  decisionsResponseSchema,
  importAssetRequestSchema,
  importBucketModelRequestSchema,
  libraryQuerySchema,
  libraryResponseSchema,
  modelDecisionSchema,
  modelPolicySchema,
  modelUploadParamsSchema,
  modelUploadPartParamsSchema,
  policiesResponseSchema,
  policyDryRunRequestSchema,
  policyDryRunResultSchema,
  registerUploadedModelRequestSchema,
  registryDecisionParamsSchema,
  registryProjectScopeQuerySchema,
  registryVersionParamsSchema,
  registryWorkspaceParamsSchema,
  requestDecisionSchema,
  resolveDecisionSchema,
  sourceSearchQuerySchema,
  sourceSearchResponseSchema,
  uploadPartResponseSchema,
  uploadSessionSchema,
  upsertPolicyRequestSchema,
  versionDetailSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  listDecisions,
  requestDecision,
  resolveDecision,
} from "~/modules/model-registry/application/decisions";
import {
  importAsset,
  importBucketModel,
  reinspectVersion,
} from "~/modules/model-registry/application/importing";
import { getVersionDetail, listLibrary } from "~/modules/model-registry/application/library";
import {
  dryRunPolicy,
  getPolicies,
  upsertPolicy,
} from "~/modules/model-registry/application/policies";
import { searchSources } from "~/modules/model-registry/application/sources";
import {
  abortUpload,
  completeUpload,
  createUpload,
  getUpload,
  registerUploadedModel,
  uploadPart,
} from "~/modules/model-registry/application/uploads";

const app = new Hono();
const tags = ["model-registry"];
const base = "/workspaces/:workspaceId";

addRoute(app, "get", `${base}/sources`, {
  auth: true,
  tags,
  summary: "Search model and dataset sources",
  description:
    "Searches Hugging Face and previews the workspace policy from metadata alone, without downloading anything.",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: sourceSearchQuerySchema,
  responses: { 200: { description: "Search results", schema: sourceSearchResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    searchSources(serviceContext, params.workspaceId, query),
});

addRoute(app, "get", `${base}/library`, {
  auth: true,
  tags,
  summary: "List models, adapters and datasets with their standing",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: libraryQuerySchema,
  responses: { 200: { description: "Library entries", schema: libraryResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listLibrary(serviceContext, params.workspaceId, query),
});

addRoute(app, "post", `${base}/imports`, {
  auth: true,
  tags,
  summary: "Import a pinned model or dataset version from Hugging Face",
  description:
    "Resolves the revision to a commit, records file hashes and queues static inspection.",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: importAssetRequestSchema,
  responses: { 200: { description: "Imported version", schema: versionDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    importAsset(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/imports/bucket`, {
  auth: true,
  tags,
  summary: "Register weights that already live in a connected bucket",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: importBucketModelRequestSchema,
  responses: { 200: { description: "Imported version", schema: versionDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    importBucketModel(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/uploads`, {
  auth: true,
  tags,
  summary: "Start a multipart upload of weights, an adapter or a dataset",
  description: "Pickle formats are refused; use safetensors, GGUF or ONNX.",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: createUploadRequestSchema,
  responses: { 200: { description: "Upload session", schema: uploadSessionSchema } },
  handler: ({ serviceContext, params, body }) =>
    createUpload(serviceContext, params.workspaceId, body),
});

addRoute(app, "get", `${base}/uploads/:uploadId`, {
  auth: true,
  tags,
  summary: "Get an upload session",
  paramSchema: modelUploadParamsSchema,
  responses: { 200: { description: "Upload session", schema: uploadSessionSchema } },
  handler: ({ serviceContext, params }) =>
    getUpload(serviceContext, params.workspaceId, params.uploadId),
});

addRoute(app, "put", `${base}/uploads/:uploadId/files/:fileIndex/parts/:partNumber`, {
  auth: true,
  tags,
  summary: "Upload one part of a file",
  paramSchema: modelUploadPartParamsSchema,
  responses: { 200: { description: "Stored part", schema: uploadPartResponseSchema } },
  handler: ({ serviceContext, params, raw }) =>
    uploadPart(
      serviceContext,
      params.workspaceId,
      params.uploadId,
      params.fileIndex,
      params.partNumber,
      raw.req.raw.body,
      Number(raw.req.header("content-length") ?? "0"),
    ),
});

addRoute(app, "post", `${base}/uploads/:uploadId/complete`, {
  auth: true,
  tags,
  summary: "Complete an upload and queue hashing and publishing",
  paramSchema: modelUploadParamsSchema,
  responses: { 200: { description: "Upload session", schema: uploadSessionSchema } },
  handler: ({ serviceContext, params }) =>
    completeUpload(serviceContext, params.workspaceId, params.uploadId),
});

addRoute(app, "post", `${base}/uploads/:uploadId/abort`, {
  auth: true,
  tags,
  summary: "Abort an upload and discard its parts",
  paramSchema: modelUploadParamsSchema,
  responses: { 200: { description: "Upload session", schema: uploadSessionSchema } },
  handler: ({ serviceContext, params }) =>
    abortUpload(serviceContext, params.workspaceId, params.uploadId),
});

addRoute(app, "post", `${base}/uploads/register`, {
  auth: true,
  tags,
  summary: "Register uploaded weights as a governed model or adapter",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: registerUploadedModelRequestSchema,
  responses: { 200: { description: "Registered version", schema: versionDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    registerUploadedModel(serviceContext, params.workspaceId, body),
});

addRoute(app, "get", `${base}/versions/:versionId`, {
  auth: true,
  tags,
  summary: "Get a version with its evidence, decisions, routes, lineage and evals",
  paramSchema: registryVersionParamsSchema,
  querySchema: registryProjectScopeQuerySchema,
  responses: { 200: { description: "Version detail", schema: versionDetailSchema } },
  handler: ({ serviceContext, params, query }) =>
    getVersionDetail(serviceContext, params.workspaceId, params.versionId, query.projectId),
});

addRoute(app, "post", `${base}/versions/:versionId/reinspect`, {
  auth: true,
  tags,
  summary: "Queue a fresh static inspection",
  paramSchema: registryVersionParamsSchema,
  responses: { 200: { description: "Version detail", schema: versionDetailSchema } },
  handler: ({ serviceContext, params }) =>
    reinspectVersion(serviceContext, params.workspaceId, params.versionId),
});

addRoute(app, "get", `${base}/policies`, {
  auth: true,
  tags,
  summary: "Get the workspace policy and any project policies",
  paramSchema: registryWorkspaceParamsSchema,
  responses: { 200: { description: "Policies", schema: policiesResponseSchema } },
  handler: ({ serviceContext, params }) => getPolicies(serviceContext, params.workspaceId),
});

addRoute(app, "put", `${base}/policies`, {
  auth: true,
  tags,
  summary: "Save a new revision of the workspace or a project policy",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: upsertPolicyRequestSchema,
  responses: { 200: { description: "Saved policy", schema: modelPolicySchema } },
  handler: ({ serviceContext, params, body }) =>
    upsertPolicy(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/policies/dry-run`, {
  auth: true,
  tags,
  summary: "Preview which verdicts change under proposed rules",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: policyDryRunRequestSchema,
  responses: { 200: { description: "Verdict changes", schema: policyDryRunResultSchema } },
  handler: ({ serviceContext, params, body }) =>
    dryRunPolicy(serviceContext, params.workspaceId, body),
});

addRoute(app, "get", `${base}/decisions`, {
  auth: true,
  tags,
  summary: "List approval decisions",
  paramSchema: registryWorkspaceParamsSchema,
  querySchema: decisionListQuerySchema,
  responses: { 200: { description: "Decisions", schema: decisionsResponseSchema } },
  handler: ({ serviceContext, params, query }) =>
    listDecisions(serviceContext, params.workspaceId, query),
});

addRoute(app, "post", `${base}/decisions`, {
  auth: true,
  tags,
  summary: "Request approval or an exception for a version or route",
  paramSchema: registryWorkspaceParamsSchema,
  bodySchema: requestDecisionSchema,
  responses: { 200: { description: "Decision", schema: modelDecisionSchema } },
  handler: ({ serviceContext, params, body }) =>
    requestDecision(serviceContext, params.workspaceId, body),
});

addRoute(app, "post", `${base}/decisions/:decisionId/resolve`, {
  auth: true,
  tags,
  summary: "Approve, reject or revoke a decision",
  paramSchema: registryDecisionParamsSchema,
  bodySchema: resolveDecisionSchema,
  responses: { 200: { description: "Decision", schema: modelDecisionSchema } },
  handler: ({ serviceContext, params, body }) =>
    resolveDecision(serviceContext, params.workspaceId, params.decisionId, body),
});

export default app;
