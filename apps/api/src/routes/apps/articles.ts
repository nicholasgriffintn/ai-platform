import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import z from "zod/v4";
import {
	articleAnalyzeSchema,
	articleDetailResponseSchema,
	articleSummariseSchema,
	contentExtractSchema,
	generateArticlesReportSchema,
	listArticlesResponseSchema,
	sourceArticlesResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { analyseArticle } from "~/services/apps/articles/analyse";
import { generateArticlesReport } from "~/services/apps/articles/generate-report";
import { getArticleDetails } from "~/services/apps/articles/get-details";
import { getSourceArticles } from "~/services/apps/articles/get-source-articles";
import { listArticles } from "~/services/apps/articles/list";
import {
	summariseArticle,
	cleanupArticleSession,
} from "~/services/apps/articles/summarise";
import { extractContent } from "~/services/apps/retrieval/content-extract";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const app = new Hono();

const routeLogger = createRouteLogger("apps/articles");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["apps"],
	description: "List user's article reports",
	responses: {
		200: { description: "List of reports", schema: listArticlesResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const user = context.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(context);
				const response = await listArticles({
					context: serviceContext,
					userId: user.id,
				});

				return ResponseFactory.success(context, {
					articles: response.sessions,
				});
			} catch (error) {
				routeLogger.error("Error listing articles:", { error });

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to list articles",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

addRoute(app, "get", "/sources", {
	tags: ["apps"],
	description: "Fetch multiple source articles by their IDs",
	responses: {
		200: {
			description: "Source articles data",
			schema: sourceArticlesResponseSchema,
		},
		400: {
			description: "Bad Request - Invalid IDs",
			schema: errorResponseSchema,
		},
		401: { description: "Unauthorized", schema: errorResponseSchema },
		403: { description: "Forbidden", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const user = context.get("user") as IUser;
			const url = new URL(context.req.url);
			const ids = url.searchParams.getAll("ids[]");

			if (!ids.length) {
				return ResponseFactory.error(context, "No article IDs provided", 400);
			}

			const validIds = ids.filter(
				(id) => typeof id === "string" && id.trim().length > 0,
			);

			try {
				const serviceContext = getServiceContext(context);
				const response = await getSourceArticles({
					context: serviceContext,
					ids: validIds,
					userId: user.id,
				});

				return ResponseFactory.success(context, {
					articles: response.articles,
				});
			} catch (error) {
				routeLogger.error("Error fetching source articles:", { error, ids });

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to fetch source articles",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get details of a specific article report",
	responses: {
		200: {
			description: "Article report details",
			schema: articleDetailResponseSchema,
		},
		401: { description: "Unauthorized", schema: errorResponseSchema },
		403: { description: "Forbidden", schema: errorResponseSchema },
		404: { description: "Article data not found", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const id = context.req.param("id");
			const user = context.get("user") as IUser;

			try {
				const serviceContext = getServiceContext(context);
				const response = await getArticleDetails({
					context: serviceContext,
					id: id ?? "",
					userId: user.id,
				});

				return ResponseFactory.success(context, { article: response.article });
			} catch (error) {
				routeLogger.error("Error getting article details:", { error, id });

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to get article details",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

addRoute(app, "post", "/analyse", {
	tags: ["apps"],
	description: "Analyse an article and save it for a session",
	bodySchema: articleAnalyzeSchema,
	responses: {
		200: {
			description: "Analysis saved",
			schema: z.object({
				status: z.string(),
				appDataId: z.string(),
				itemId: z.string(),
				analysis: z.any(),
			}),
		},
		400: { description: "Bad Request", schema: errorResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as z.infer<
				typeof articleAnalyzeSchema
			>;
			const user = context.get("user") as IUser;

			try {
				const completion_id = generateId();
				const newUrl = new URL(context.req.url);
				const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

				const serviceContext = getServiceContext(context);
				const response = await analyseArticle({
					completion_id,
					context: serviceContext,
					args: { article: body.article, itemId: body.itemId },
					app_url,
					user,
				});

				return ResponseFactory.success(context, response);
			} catch (error) {
				routeLogger.error("Error analysing article:", {
					error,
					itemId: body.itemId,
				});

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to analyse article",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

addRoute(app, "post", "/summarise", {
	tags: ["apps"],
	description: "Summarise an article and save it for a session",
	bodySchema: articleSummariseSchema,
	responses: {
		200: {
			description: "Summary saved",
			schema: z.object({
				status: z.string(),
				appDataId: z.string(),
				itemId: z.string(),
				summary: z.any(),
			}),
		},
		400: { description: "Bad Request", schema: errorResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as z.infer<
				typeof articleSummariseSchema
			>;
			const user = context.get("user") as IUser;

			try {
				const completion_id = generateId();
				const newUrl = new URL(context.req.url);
				const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

				const serviceContext = getServiceContext(context);
				const response = await summariseArticle({
					completion_id,
					context: serviceContext,
					args: { article: body.article, itemId: body.itemId },
					app_url,
					user,
				});

				return ResponseFactory.success(context, response);
			} catch (error) {
				routeLogger.error("Error summarising article:", {
					error,
					itemId: body.itemId,
				});

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to summarise article",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

addRoute(app, "post", "/generate-report", {
	tags: ["apps"],
	description:
		"Generates a comparison report from saved articles for a specific session (itemId)",
	bodySchema: generateArticlesReportSchema,
	responses: {
		200: {
			description: "Report generated and saved",
			schema: z.object({
				status: z.string(),
				appDataId: z.string(),
				itemId: z.string(),
			}),
		},
		401: { description: "Unauthorized", schema: errorResponseSchema },
		404: {
			description: "No analysis data found to generate report",
			schema: errorResponseSchema,
		},
		500: {
			description: "Failed to generate or save report",
			schema: errorResponseSchema,
		},
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as z.infer<
				typeof generateArticlesReportSchema
			>;
			const user = context.get("user") as IUser;

			try {
				const completion_id = generateId();
				const newUrl = new URL(context.req.url);
				const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

				const serviceContext = getServiceContext(context);
				const response = await generateArticlesReport({
					completion_id,
					context: serviceContext,
					args: { itemId: body.itemId },
					app_url,
					user,
				});

				return ResponseFactory.success(context, response);
			} catch (error) {
				routeLogger.error("Error generating report:", {
					error,
					itemId: body.itemId,
				});

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to generate report",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

addRoute(app, "post", "/prepare-rerun/:itemId", {
	tags: ["apps"],
	description:
		"Prepare a session for rerun by cleaning up existing analyses and summaries",
	responses: {
		200: {
			description: "Session prepared for rerun",
			schema: z.object({
				status: z.string(),
				message: z.string(),
			}),
		},
		400: { description: "Bad Request", schema: errorResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const itemId = context.req.param("itemId");
			const user = context.get("user") as IUser;

			if (!itemId) {
				return ResponseFactory.error(context, "Item ID is required", 400);
			}

			try {
				// Delete existing analyses and summaries for this session
				const serviceContext = getServiceContext(context);
				await cleanupArticleSession(serviceContext, user.id, itemId);

				return ResponseFactory.message(context, "Session prepared for rerun");
			} catch (error) {
				routeLogger.error("Error preparing session for rerun:", {
					error,
					itemId,
				});

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to prepare session for rerun",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

addRoute(app, "post", "/extract-content", {
	tags: ["apps"],
	description: "Extract content from URLs for article analysis",
	bodySchema: contentExtractSchema,
	responses: {
		200: {
			description: "Content successfully extracted",
			schema: z.object({
				status: z.string(),
				data: z.object({
					content: z.array(z.string()),
					failedUrls: z.array(
						z.object({
							url: z.string(),
							error: z.string(),
						}),
					),
				}),
			}),
		},
		400: { description: "Bad Request", schema: errorResponseSchema },
		401: { description: "Unauthorized", schema: errorResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as z.infer<
				typeof contentExtractSchema
			>;
			const user = context.get("user") as IUser;

			try {
				const extractResult = await extractContent(
					{
						urls: body.urls,
						extract_depth: body.extract_depth || "basic",
						include_images: body.include_images || false,
					},
					{
						env: context.env,
						user,
					},
				);

				if (extractResult.status === "error") {
					return ResponseFactory.error(
						context,
						"Failed to extract content",
						400,
					);
				}

				const content =
					extractResult.data?.extracted.results.map(
						(result) => result.raw_content,
					) || [];

				const failedUrls = extractResult.data?.extracted.failed_results || [];

				return ResponseFactory.success(context, {
					content,
					failedUrls,
				});
			} catch (error) {
				routeLogger.error("Error extracting content from URL:", {
					error,
					urls: body.urls,
				});

				if (error instanceof AssistantError) {
					throw error;
				}

				throw new AssistantError(
					"Failed to extract content from URL",
					ErrorType.UNKNOWN_ERROR,
					undefined,
					error,
				);
			}
		})(raw),
});

export default app;
