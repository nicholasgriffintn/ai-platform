import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import {
	capabilitiesResponseSchema,
	capabilityParamsSchema,
	artificialAnalysisModelsResponseSchema,
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
	listArtificialAnalysisModels,
	listStrengths,
	listModalities,
	listModels,
	listModelsByStrength,
	listModelsByModality,
	listModelsByOutputModality,
} from "~/services/models";
import { availableModalities } from "~/constants/models";

const app = new Hono();

const routeLogger = createRouteLogger("models");

app.use("/*", (c, next) => {
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
	handler: async ({ serviceContext, user }) => listModels(serviceContext.env, user?.id),
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
	handler: async () => listStrengths(),
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
	handler: async ({ params, raw, serviceContext, user }) => {
		const validCapabilities = listStrengths();
		if (!validCapabilities.includes(params.capability)) {
			return ResponseFactory.error(raw, "Invalid capability parameter", 400);
		}
		return listModelsByStrength(serviceContext.env, params.capability, user?.id);
	},
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
	handler: async () => listModalities(),
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
	handler: async ({ params, raw, serviceContext, user }) => {
		if (!availableModalities.includes(params.modality as (typeof availableModalities)[number])) {
			return ResponseFactory.error(raw, "Invalid modality parameter", 400);
		}
		return listModelsByModality(serviceContext.env, params.modality, user?.id);
	},
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
	handler: async ({ params, raw, serviceContext, user }) => {
		if (!availableModalities.includes(params.modality as never)) {
			return ResponseFactory.error(raw, "Invalid modality parameter", 400);
		}
		return listModelsByOutputModality(serviceContext.env, params.modality, user?.id);
	},
});

addRoute(app, "get", "/artificial-analysis", {
	tags: ["models"],
	summary: "List cached Artificial Analysis model data",
	description:
		"Returns cached Artificial Analysis language model benchmark, pricing, and performance data with source attribution.",
	responses: {
		200: {
			description: "Cached Artificial Analysis model data",
			schema: artificialAnalysisModelsResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ serviceContext }) => listArtificialAnalysisModels(serviceContext.env),
});

addRoute(app, "get", "/:id", {
	tags: ["models"],
	summary: "Retrieve model",
	description: "Retrieves a model instance, providing basic information about the model.",
	paramSchema: modelParamsSchema,
	responses: {
		200: { description: "Model details", schema: modelResponseSchema },
		400: { description: "Invalid model ID", schema: errorResponseSchema },
		404: { description: "Model not found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ params, raw, serviceContext, user }) => {
		try {
			return await getModelDetails(serviceContext.env, params.id, user?.id);
		} catch {
			return ResponseFactory.error(raw, "Model not found or user does not have access", 404);
		}
	},
});

export default app;
