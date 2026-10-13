import {
  artifactBindingReadRequestSchema,
  artifactBindingReadResponseSchema,
  errorResponseSchema,
  getChatCompletionParamsSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { readArtifactBinding } from "~/modules/conversations/application/artifact-bindings";

export function registerArtifactBindingRoutes(app: Hono): void {
  addRoute(app, "post", "/completions/:completion_id/artifact-bindings/read", {
    auth: true,
    tags: ["chat"],
    cache: "no-store",
    summary: "Read an artifact's declared data source",
    description:
      "Runs one read-only data source that an artifact declared when it was written. The declaration is read from the stored message, so the caller only names it.",
    paramSchema: getChatCompletionParamsSchema,
    bodySchema: artifactBindingReadRequestSchema,
    responses: {
      200: {
        description: "The data source's latest result",
        schema: artifactBindingReadResponseSchema,
      },
      403: { description: "The data source would change something", schema: errorResponseSchema },
      404: { description: "Data source not found", schema: errorResponseSchema },
      429: { description: "Read too often", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, body }) =>
      readArtifactBinding(serviceContext, params.completion_id, body),
  });
}
