import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	deleteEmbeddingSchema,
	insertEmbeddingSchema,
	queryEmbeddingsSchema,
	apiResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
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

const app = new Hono();

const routeLogger = createRouteLogger("apps/embeddings");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

addRoute(app, "post", "/insert", {
	tags: ["apps"],
	description: "Insert an embedding into the database",
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
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid(
				"json" as never,
			) as IInsertEmbeddingRequest["request"];
			const user = context.get("user");

			const response = await insertEmbedding({
				request: body,
				env: context.env as IEnv,
				user,
			});

			if (response.status === "error") {
				throw new AssistantError(
					"Something went wrong, we are working on it",
					ErrorType.UNKNOWN_ERROR,
				);
			}

			return ResponseFactory.success(context, { response });
		})(raw),
});

addRoute(app, "get", "/query", {
	tags: ["apps"],
	description: "Query embeddings from the database",
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
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const query = context.req.valid("query" as never);
			const user = context.get("user");
			const response = await queryEmbeddings({
				env: context.env as IEnv,
				request: { query },
				user,
			});

			if (response.status === "error") {
				throw new AssistantError(
					"Something went wrong, we are working on it",
					ErrorType.UNKNOWN_ERROR,
				);
			}

			return ResponseFactory.success(context, { response });
		})(raw),
});

addRoute(app, "post", "/delete", {
	tags: ["apps"],
	description: "Delete embeddings from the database",
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
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid(
				"json" as never,
			) as IDeleteEmbeddingRequest["request"];
			const user = context.get("user");
			const response = await deleteEmbedding({
				env: context.env as IEnv,
				request: body,
				user,
			});

			if (response.status === "error") {
				throw new AssistantError(
					"Something went wrong, we are working on it",
					ErrorType.UNKNOWN_ERROR,
				);
			}

			return ResponseFactory.success(context, { response });
		})(raw),
});

export default app;
