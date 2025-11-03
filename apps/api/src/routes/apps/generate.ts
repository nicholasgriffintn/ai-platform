import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import {
	imageGenerationSchema,
	musicGenerationSchema,
	speechGenerationSchema,
	videoGenerationSchema,
	apiResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	type ImageGenerationParams,
	generateImage,
} from "~/services/apps/generate/image";
import {
	type MusicGenerationParams,
	generateMusic,
} from "~/services/apps/generate/music";
import {
	type SpeechGenerationParams,
	generateSpeech,
} from "~/services/apps/generate/speech";
import {
	type VideoGenerationParams,
	generateVideo,
} from "~/services/apps/generate/video";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const app = new Hono();

const routeLogger = createRouteLogger("apps/generate");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps route: ${c.req.path}`);
	return next();
});

app.post(
	"/image",
	describeRoute({
		tags: ["apps"],
		description: "Generate an image",
		responses: {
			200: {
				description: "Generated image result",
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
	zValidator("json", imageGenerationSchema),
	requirePlan("pro"),
	async (context: Context) => {
		const body = context.req.valid("json" as never) as ImageGenerationParams;
		const completion_id = generateId();
		const newUrl = new URL(context.req.url);
		const app_url = `${newUrl.protocol}//${newUrl.hostname}`;
		const user = context.get("user");
		const serviceContext = getServiceContext(context);

		const response = await generateImage({
			completion_id,
			env: context.env as IEnv,
			context: serviceContext,
			args: body,
			app_url,
			user,
		});

		if (response.status === "error") {
			throw new AssistantError(
				"Something went wrong, we are working on it",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		return ResponseFactory.success(context, { response });
	},
);

app.post(
	"/video",
	describeRoute({
		tags: ["apps"],
		description: "Generate a video",
		responses: {
			200: {
				description: "Response",
				content: {
					"application/json": {
						schema: resolver(apiResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", videoGenerationSchema),
	requirePlan("pro"),
	async (context: Context) => {
		const body = context.req.valid("json" as never) as VideoGenerationParams;
		const completion_id = generateId();
		const newUrl = new URL(context.req.url);
		const app_url = `${newUrl.protocol}//${newUrl.hostname}`;
		const user = context.get("user");
		const serviceContext = getServiceContext(context);

		const response = await generateVideo({
			completion_id,
			env: context.env as IEnv,
			context: serviceContext,
			args: body,
			app_url,
			user,
		});

		if (response.status === "error") {
			throw new AssistantError(
				"Something went wrong, we are working on it",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		return ResponseFactory.success(context, { response });
	},
);

app.post(
	"/music",
	describeRoute({
		tags: ["apps"],
		description: "Generate music",
		responses: {
			200: {
				description: "Response",
				content: {
					"application/json": {
						schema: resolver(apiResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", musicGenerationSchema),
	requirePlan("pro"),
	async (context: Context) => {
		const body = context.req.valid("json" as never) as MusicGenerationParams;
		const completion_id = generateId();
		const newUrl = new URL(context.req.url);
		const app_url = `${newUrl.protocol}//${newUrl.hostname}`;
		const user = context.get("user");
		const serviceContext = getServiceContext(context);

		const response = await generateMusic({
			completion_id,
			env: context.env as IEnv,
			context: serviceContext,
			args: body,
			app_url,
			user,
		});

		if (response.status === "error") {
			throw new AssistantError(
				"Something went wrong, we are working on it",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		return ResponseFactory.success(context, { response });
	},
);

app.post(
	"/speech",
	describeRoute({
		tags: ["apps"],
		description: "Generate speech from text",
		responses: {
			200: {
				description: "Response",
				content: {
					"application/json": {
						schema: resolver(apiResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", speechGenerationSchema),
	requirePlan("pro"),
	async (context: Context) => {
		const body = context.req.valid("json" as never) as SpeechGenerationParams;
		const completion_id = generateId();
		const newUrl = new URL(context.req.url);
		const app_url = `${newUrl.protocol}//${newUrl.hostname}`;
		const user = context.get("user");
		const serviceContext = getServiceContext(context);

		const response = await generateSpeech({
			completion_id,
			env: context.env as IEnv,
			context: serviceContext,
			args: body,
			app_url,
			user,
		});

		if (response.status === "error") {
			throw new AssistantError(
				"Something went wrong, we are working on it",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		return ResponseFactory.success(context, { response });
	},
);

export default app;
