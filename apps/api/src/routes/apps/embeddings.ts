import {
  deleteEmbeddingSchema,
  insertEmbeddingSchema,
  queryEmbeddingsSchema,
  apiResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { deleteEmbedding } from "~/services/apps/embeddings/delete";
import { insertEmbedding } from "~/services/apps/embeddings/insert";
import { queryEmbeddings } from "~/services/apps/embeddings/query";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/embeddings");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);

  return next();
});

addRoute(app, "post", "/insert", {
  tags: ["apps"],
  description: "Insert an embedding into the database",
  auth: true,
  bodySchema: insertEmbeddingSchema,
  responses: {
    200: {
      description: "Success response for embedding insertion",
      schema: apiResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  middleware: [requirePlan("pro")],
  handler: async ({ body, serviceContext }) => {
    const response = await insertEmbedding({
      request: body,
      context: serviceContext,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return { response };
  },
});

addRoute(app, "get", "/query", {
  tags: ["apps"],
  description: "Query embeddings from the database",
  auth: true,
  querySchema: queryEmbeddingsSchema,
  responses: {
    200: {
      description: "Success response with embedding query results",
      schema: apiResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  middleware: [requirePlan("pro")],
  handler: async ({ query, serviceContext }) => {
    const response = await queryEmbeddings({
      context: serviceContext,
      request: query,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return { response };
  },
});

addRoute(app, "post", "/delete", {
  tags: ["apps"],
  description: "Delete embeddings from the database",
  auth: true,
  bodySchema: deleteEmbeddingSchema,
  responses: {
    200: {
      description: "Success response for embedding deletion",
      schema: apiResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  middleware: [requirePlan("pro")],
  handler: async ({ body, serviceContext }) => {
    const response = await deleteEmbedding({
      context: serviceContext,
      request: body,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return { response };
  },
});

export default app;
