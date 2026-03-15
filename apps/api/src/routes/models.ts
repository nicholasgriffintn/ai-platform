import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	capabilitiesResponseSchema,
	capabilityParamsSchema,
	modelParamsSchema,
	modelResponseSchema,
	modelsResponseSchema,
	modalityParamsSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	getModelDetails,
	listStrengths,
	listModalities,
	listModels,
	listModelsByStrength,
	listModelsByModality,
	listModelsByOutputModality,
} from "~/services/models";
import type { IEnv } from "~/types";
import { availableModalities } from "~/constants/models";

const app = new Hono();

const routeLogger = createRouteLogger("models");

app.use("/*", (c: Context, next) => {
	routeLogger.info(`Processing models route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["models"],
	summary: "List models",
	description:
		"Lists the currently available models, and provides basic information about each one such as the capabilities and pricing.",
	responses: {
		200: {
			description: "List of available models with their details",
			schema: modelsResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const userId = context.get("user")?.id;
			const models = await listModels(context.env, userId);
			return ResponseFactory.success(context, models);
		})(raw),
});

addRoute(app, "get", "/capabilities", {
	tags: ["models"],
	summary: "Get all capabilities",
	description: "Returns a list of all available model capabilities",
	responses: {
		200: {
			description: "List of all available model capabilities",
			schema: capabilitiesResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const caps = listStrengths();
			return ResponseFactory.success(context, caps);
		})(raw),
});

addRoute(app, "get", "/capabilities/:capability", {
	tags: ["models"],
	summary: "Get models by capability",
	description: "Returns all models that support a specific capability",
	paramSchema: capabilityParamsSchema,
	responses: {
		200: {
			description: "List of models with the specified capability",
			schema: modelsResponseSchema,
		},
		400: {
			description: "Invalid capability parameter",
			schema: errorResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { capability } = context.req.valid("param" as never) as {
				capability: string;
			};
			const validCapabilities = listStrengths();
			if (!validCapabilities.includes(capability)) {
				return ResponseFactory.error(
					context,
					"Invalid capability parameter",
					400,
				);
			}
			const userId = context.get("user")?.id;
			const models = await listModelsByStrength(
				context.env as IEnv,
				capability,
				userId,
			);
			return ResponseFactory.success(context, models);
		})(raw),
});

addRoute(app, "get", "/modalities", {
	tags: ["models"],
	summary: "Get all model modalities",
	description: "Returns a list of all supported input/output modalities",
	responses: {
		200: {
			description: "List of all available model modalities",
			schema: capabilitiesResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const modalities = listModalities();
			return ResponseFactory.success(context, modalities);
		})(raw),
});

addRoute(app, "get", "/modalities/:modality", {
	tags: ["models"],
	summary: "Get models by modality",
	description: "Returns all models that support a specific modality",
	paramSchema: modalityParamsSchema,
	responses: {
		200: {
			description: "List of models of the specified modality",
			schema: modelsResponseSchema,
		},
		400: {
			description: "Invalid modality parameter",
			schema: errorResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { modality } = context.req.valid("param" as never) as {
				modality: string;
			};
			if (
				!availableModalities.includes(
					modality as (typeof availableModalities)[number],
				)
			) {
				return ResponseFactory.error(
					context,
					"Invalid modality parameter",
					400,
				);
			}
			const userId = context.get("user")?.id;
			const models = await listModelsByModality(
				context.env as IEnv,
				modality,
				userId,
			);
			return ResponseFactory.success(context, models);
		})(raw),
});

addRoute(app, "get", "/output/:modality", {
	tags: ["models"],
	summary: "Get models by output modality",
	description: "Returns all models that output the specified modality",
	paramSchema: modalityParamsSchema,
	responses: {
		200: {
			description: "List of models with the specified output modality",
			schema: modelsResponseSchema,
		},
		400: {
			description: "Invalid modality parameter",
			schema: errorResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { modality } = context.req.valid("param" as never) as {
				modality: string;
			};
			if (!availableModalities.includes(modality as never)) {
				return ResponseFactory.error(
					context,
					"Invalid modality parameter",
					400,
				);
			}
			const userId = context.get("user")?.id;
			const models = await listModelsByOutputModality(
				context.env as IEnv,
				modality,
				userId,
			);
			return ResponseFactory.success(context, models);
		})(raw),
});

addRoute(app, "get", "/:id", {
	tags: ["models"],
	summary: "Retrieve model",
	description:
		"Retrieves a model instance, providing basic information about the model.",
	paramSchema: modelParamsSchema,
	responses: {
		200: { description: "Model details", schema: modelResponseSchema },
		400: { description: "Invalid model ID", schema: errorResponseSchema },
		404: { description: "Model not found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { id } = context.req.valid("param" as never) as { id: string };
			const userId = context.get("user")?.id;
			try {
				const model = await getModelDetails(context.env as IEnv, id, userId);
				return ResponseFactory.success(context, model);
			} catch {
				return ResponseFactory.error(
					context,
					"Model not found or user does not have access",
					404,
				);
			}
		})(raw),
});

export default app;
