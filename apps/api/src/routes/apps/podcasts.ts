import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	listPodcastsResponseSchema,
	podcastDetailResponseSchema,
	podcastGenerateImageSchema,
	podcastSummarizeSchema,
	podcastTranscribeSchema,
	apiResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { handlePodcastGenerateImage } from "~/services/apps/podcast/generate-image";
import { handlePodcastDetail } from "~/services/apps/podcast/get-details";
import { handlePodcastList } from "~/services/apps/podcast/list";
import {
	type IPodcastSummariseBody,
	handlePodcastSummarise,
} from "~/services/apps/podcast/summarise";
import {
	type IPodcastTranscribeBody,
	handlePodcastTranscribe,
} from "~/services/apps/podcast/transcribe";
import { handlePodcastUpload } from "~/services/apps/podcast/upload";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/podcasts");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["apps"],
	description: "List user's podcasts",
	responses: {
		200: {
			description: "List of user's podcasts",
			schema: listPodcastsResponseSchema,
		},
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const user = context.get("user");

			try {
				const serviceContext = getServiceContext(context);
				const podcasts = await handlePodcastList({
					context: serviceContext,
					user,
				});

				return ResponseFactory.success(context, { podcasts });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}

				routeLogger.error("Error fetching podcasts:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to fetch podcasts",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get podcast details",
	responses: {
		200: {
			description: "Podcast details",
			schema: podcastDetailResponseSchema,
		},
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const id = context.req.param("id");
			const user = context.get("user");

			try {
				const serviceContext = getServiceContext(context);
				const podcast = await handlePodcastDetail({
					context: serviceContext,
					podcastId: id,
					user,
				});

				return ResponseFactory.success(context, { podcast });
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}

				routeLogger.error("Error fetching podcast:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to fetch podcast",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/upload", {
	tags: ["apps"],
	description: "Upload a podcast",
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			try {
				const formData = await context.req.formData();
				const title = formData.get("title") as string;
				const description = formData.get("description") as string | null;
				const audio = formData.get("audio") as File | null;
				const audioUrl = formData.get("audioUrl") as string | null;

				if (!audio && !audioUrl) {
					throw new AssistantError(
						"Missing audio file or URL",
						ErrorType.PARAMS_ERROR,
					);
				}

				const user = context.get("user");
				const serviceContext = getServiceContext(context);

				const response = await handlePodcastUpload({
					context: serviceContext,
					request: {
						audio,
						audioUrl,
						title,
						description: description || undefined,
					},
					user,
				});

				if (response.status === "error") {
					throw new AssistantError(
						"Something went wrong, we are working on it",
						ErrorType.UNKNOWN_ERROR,
					);
				}

				return ResponseFactory.success(context, {
					response,
				});
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
				routeLogger.error("Error uploading podcast:", {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				throw new AssistantError(
					"Failed to upload podcast",
					ErrorType.UNKNOWN_ERROR,
				);
			}
		})(raw),
});

addRoute(app, "post", "/transcribe", {
	tags: ["apps"],
	description: "Transcribe a podcast",
	bodySchema: podcastTranscribeSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as IPodcastTranscribeBody;
			const user = context.get("user");
			const newUrl = new URL(context.req.url);
			const app_url = `${newUrl.protocol}//${newUrl.hostname}`;
			const serviceContext = getServiceContext(context);

			const response = await handlePodcastTranscribe({
				context: serviceContext,
				request: body,
				user,
				app_url,
			});

			return ResponseFactory.success(context, { response });
		})(raw),
});

addRoute(app, "post", "/summarise", {
	tags: ["apps"],
	description: "Summarise a podcast",
	bodySchema: podcastSummarizeSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as IPodcastSummariseBody;
			const user = context.get("user");

			const serviceContext = getServiceContext(context);
			const response = await handlePodcastSummarise({
				context: serviceContext,
				request: body,
				user,
			});

			return ResponseFactory.success(context, { response });
		})(raw),
});

addRoute(app, "post", "/generate-image", {
	tags: ["apps"],
	description: "Generate an image for a podcast",
	bodySchema: podcastGenerateImageSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	middleware: [requirePlan("pro")],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as {
				podcastId: string;
				prompt?: string;
			};
			const user = context.get("user");
			const serviceContext = getServiceContext(context);
			const response = await handlePodcastGenerateImage({
				context: serviceContext,
				request: body,
				user,
			});

			return ResponseFactory.success(context, { response });
		})(raw),
});

export default app;
