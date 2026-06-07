import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";
import { z } from "zod/v4";

import {
	listPodcastsResponseSchema,
	podcastDetailResponseSchema,
	podcastGenerateImageSchema,
	podcastSummarizeSchema,
	podcastTranscribeSchema,
	apiResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { handlePodcastGenerateImage } from "~/services/apps/podcast/generate-image";
import { handlePodcastDetail } from "~/services/apps/podcast/get-details";
import { handlePodcastList } from "~/services/apps/podcast/list";
import { handlePodcastSummarise } from "~/services/apps/podcast/summarise";
import { handlePodcastTranscribe } from "~/services/apps/podcast/transcribe";
import { handlePodcastUpload } from "~/services/apps/podcast/upload";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/podcasts");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

const podcastParamsSchema = z.object({
	id: z.string().min(1),
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
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ serviceContext, user }) => {
		try {
			const podcasts = await handlePodcastList({
				context: serviceContext,
				user,
			});

			return { podcasts };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error fetching podcasts:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch podcasts", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	description: "Get podcast details",
	paramSchema: podcastParamsSchema,
	responses: {
		200: {
			description: "Podcast details",
			schema: podcastDetailResponseSchema,
		},
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ params, serviceContext, user }) => {
		try {
			const podcast = await handlePodcastDetail({
				context: serviceContext,
				podcastId: params.id,
				user,
			});

			return { podcast };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error fetching podcast:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch podcast", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "post", "/upload", {
	tags: ["apps"],
	description: "Upload a podcast",
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ raw, serviceContext, user }) => {
		try {
			const formData = await raw.req.formData();
			const title = formData.get("title") as string;
			const description = formData.get("description") as string | null;
			const audio = formData.get("audio") as File | null;
			const audioUrl = formData.get("audioUrl") as string | null;

			if (!audio && !audioUrl) {
				throw new AssistantError("Missing audio file or URL", ErrorType.PARAMS_ERROR);
			}

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

			return { response };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			routeLogger.error("Error uploading podcast:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to upload podcast", ErrorType.UNKNOWN_ERROR);
		}
	},
});

addRoute(app, "post", "/transcribe", {
	tags: ["apps"],
	description: "Transcribe a podcast",
	bodySchema: podcastTranscribeSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ body, raw, serviceContext, user }) => {
		const newUrl = new URL(raw.req.url);
		const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

		const response = await handlePodcastTranscribe({
			context: serviceContext,
			request: body,
			user,
			app_url,
		});

		return { response };
	},
});

addRoute(app, "post", "/summarise", {
	tags: ["apps"],
	description: "Summarise a podcast",
	bodySchema: podcastSummarizeSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ body, serviceContext, user }) => {
		const response = await handlePodcastSummarise({
			context: serviceContext,
			request: body,
			user,
		});

		return { response };
	},
});

addRoute(app, "post", "/generate-image", {
	tags: ["apps"],
	description: "Generate an image for a podcast",
	bodySchema: podcastGenerateImageSchema,
	responses: {
		200: { description: "Response", schema: apiResponseSchema },
	},
	auth: true,
	middleware: [requirePlan("pro")],
	handler: async ({ body, serviceContext, user }) => {
		const response = await handlePodcastGenerateImage({
			context: serviceContext,
			request: body,
			user,
		});

		return { response };
	},
});

export default app;
