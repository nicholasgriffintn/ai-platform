import {
  errorResponseSchema,
  ocrBatchCancelResponseSchema,
  ocrBatchStartRequestSchema,
  ocrBatchStartResponseSchema,
  outputSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { z } from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  cancelOcrBatch,
  getOcrBatchStatus,
  startOcrBatch,
} from "~/services/apps/retrieval/ocr/batch";
import { projectScopeQuerySchema } from "~/services/workspaces/access";

const app = new Hono();
const batchParamsSchema = z.object({ outputId: z.string().min(1) }).strict();

addRoute(app, "post", "/", {
  auth: true,
  tags: ["apps"],
  summary: "Start an OCR batch",
  description:
    "Starts a bounded asynchronous Mistral OCR batch and stores its progress as an Output.",
  querySchema: projectScopeQuerySchema,
  bodySchema: ocrBatchStartRequestSchema,
  responses: {
    200: { description: "OCR batch accepted", schema: ocrBatchStartResponseSchema },
    400: { description: "Invalid OCR batch", schema: errorResponseSchema },
  },
  handler: async ({ body, query, serviceContext, user }) =>
    startOcrBatch(serviceContext, user, body, { projectId: query.projectId }),
});

addRoute(app, "get", "/:outputId", {
  auth: true,
  tags: ["apps"],
  summary: "Get an OCR batch",
  paramSchema: batchParamsSchema,
  responses: {
    200: { description: "Current OCR batch Output", schema: outputSchema },
    404: { description: "OCR batch not found", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext, user }) =>
    getOcrBatchStatus(serviceContext, user.id, params.outputId),
});

addRoute(app, "post", "/:outputId/cancel", {
  auth: true,
  tags: ["apps"],
  summary: "Cancel an OCR batch",
  paramSchema: batchParamsSchema,
  responses: {
    200: { description: "OCR batch cancelled", schema: ocrBatchCancelResponseSchema },
    404: { description: "OCR batch not found", schema: errorResponseSchema },
    409: { description: "OCR batch is already terminal", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext, user }) =>
    cancelOcrBatch(serviceContext, user, params.outputId),
});

export default app;
