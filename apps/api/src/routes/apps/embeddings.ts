import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  type IDeleteEmbeddingRequest,
  deleteEmbedding,
} from "~/services/apps/embeddings/delete";
import {
  type IInsertEmbeddingRequest,
  insertEmbedding,
} from "~/services/apps/embeddings/insert";
import { queryEmbeddings } from "~/services/apps/embeddings/query";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  deleteEmbeddingSchema,
  insertEmbeddingSchema,
  queryEmbeddingsSchema,
} from "../schemas/apps";
import { apiResponseSchema, errorResponseSchema } from "../schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("APPS_EMBEDDINGS");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.post(
  "/insert",
  describeRoute({
    tags: ["apps"],
    description: "Insert an embedding into the database",
    responses: {
      200: {
        description: "Success response for embedding insertion",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", insertEmbeddingSchema),
  async (context: Context) => {
    const body = context.req.valid(
      "json" as never,
    ) as IInsertEmbeddingRequest["request"];

    const response = await insertEmbedding({
      request: body,
      env: context.env as IEnv,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return context.json({
      response,
    });
  },
);

app.get(
  "/query",
  describeRoute({
    tags: ["apps"],
    description: "Query embeddings from the database",
    responses: {
      200: {
        description: "Success response with embedding query results",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("query", queryEmbeddingsSchema),
  async (context: Context) => {
    const query = context.req.valid("query" as never);

    const response = await queryEmbeddings({
      env: context.env as IEnv,
      request: { query },
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return context.json({
      response,
    });
  },
);

app.post(
  "/delete",
  describeRoute({
    tags: ["apps"],
    description: "Delete embeddings from the database",
    responses: {
      200: {
        description: "Success response for embedding deletion",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", deleteEmbeddingSchema),
  async (context: Context) => {
    const body = context.req.valid(
      "json" as never,
    ) as IDeleteEmbeddingRequest["request"];

    const response = await deleteEmbedding({
      env: context.env as IEnv,
      request: body,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return context.json({
      response,
    });
  },
);

export default app;
