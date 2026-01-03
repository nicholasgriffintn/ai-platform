import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
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

app.get(
	"/",
	describeRoute({
		tags: ["models"],
		summary: "List models",
		description:
			"Lists the currently available models, and provides basic information about each one such as the capabilities and pricing.",
		responses: {
			200: {
				description: "List of available models with their details",
				content: {
					"application/json": {
						schema: resolver(modelsResponseSchema),
					},
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (context: Context) => {
		const userId = context.get("user")?.id;
		const models = await listModels(context.env, userId);
		return ResponseFactory.success(context, {
			success: true,
			message: "Models fetched successfully",
			data: models,
		});
	},
);

app.get(
	"/capabilities",
	describeRoute({
		tags: ["models"],
		summary: "Get all capabilities",
		description: "Returns a list of all available model capabilities",
		responses: {
			200: {
				description: "List of all available model capabilities",
				content: {
					"application/json": {
						schema: resolver(capabilitiesResponseSchema),
					},
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (context: Context) => {
		const caps = listStrengths();
		return ResponseFactory.success(context, {
			success: true,
			message: "Capabilities fetched successfully",
			data: caps,
		});
	},
);

app.get(
	"/capabilities/:capability",
	describeRoute({
		tags: ["models"],
		summary: "Get models by capability",
		description: "Returns all models that support a specific capability",
		parameters: [
			{
				name: "capability",
				in: "path",
				required: true,
				schema: { type: "string" },
				description: "Capability to filter models by",
			},
		],
		responses: {
			200: {
				description: "List of models with the specified capability",
				content: {
					"application/json": {
						schema: resolver(modelsResponseSchema),
					},
				},
			},
			400: {
				description: "Invalid capability parameter",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("param", capabilityParamsSchema),
	async (context: Context) => {
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
		return ResponseFactory.success(context, {
			success: true,
			message: "Models fetched successfully",
			data: models,
		});
	},
);

app.get(
	"/modalities",
	describeRoute({
		tags: ["models"],
		summary: "Get all model modalities",
		description: "Returns a list of all supported input/output modalities",
		responses: {
			200: {
				description: "List of all available model modalities",
				content: {
					"application/json": {
						schema: resolver(capabilitiesResponseSchema),
					},
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (context: Context) => {
		const modalities = listModalities();
		return ResponseFactory.success(context, {
			success: true,
			message: "Model modalities fetched successfully",
			data: modalities,
		});
	},
);

app.get(
	"/modalities/:modality",
	describeRoute({
		tags: ["models"],
		summary: "Get models by modality",
		description: "Returns all models that support a specific modality",
		parameters: [
			{
				name: "modality",
				in: "path",
				required: true,
				schema: { type: "string" },
				description: "Modality to filter models by",
			},
		],
		responses: {
			200: {
				description: "List of models of the specified modality",
				content: {
					"application/json": {
						schema: resolver(modelsResponseSchema),
					},
				},
			},
			400: {
				description: "Invalid modality parameter",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("param", modalityParamsSchema),
	async (context: Context) => {
		const { modality } = context.req.valid("param" as never) as {
			modality: string;
		};
		if (
			!availableModalities.includes(
				modality as (typeof availableModalities)[number],
			)
		) {
			return ResponseFactory.error(context, "Invalid modality parameter", 400);
		}
		const userId = context.get("user")?.id;
		const models = await listModelsByModality(
			context.env as IEnv,
			modality,
			userId,
		);
		return ResponseFactory.success(context, {
			success: true,
			message: "Models fetched successfully",
			data: models,
		});
	},
);

app.get(
	"/output/:modality",
	describeRoute({
		tags: ["models"],
		summary: "Get models by output modality",
		description: "Returns all models that output the specified modality",
		parameters: [
			{
				name: "modality",
				in: "path",
				required: true,
				schema: { type: "string" },
				description: "Output modality to filter models by",
			},
		],
		responses: {
			200: {
				description: "List of models with the specified output modality",
				content: {
					"application/json": {
						schema: resolver(modelsResponseSchema),
					},
				},
			},
			400: {
				description: "Invalid modality parameter",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("param", modalityParamsSchema),
	async (context: Context) => {
		const { modality } = context.req.valid("param" as never) as {
			modality: string;
		};
		if (!availableModalities.includes(modality as never)) {
			return ResponseFactory.error(context, "Invalid modality parameter", 400);
		}
		const userId = context.get("user")?.id;
		const models = await listModelsByOutputModality(
			context.env as IEnv,
			modality,
			userId,
		);
		return ResponseFactory.success(context, {
			success: true,
			message: "Models fetched successfully",
			data: models,
		});
	},
);

app.get(
	"/:id",
	describeRoute({
		tags: ["models"],
		summary: "Retrieve model",
		description:
			"Retrieves a model instance, providing basic information about the model.",
		parameters: [
			{
				name: "id",
				in: "path",
				required: true,
				schema: { type: "string" },
				description: "Model ID to retrieve",
			},
		],
		responses: {
			200: {
				description: "Model details",
				content: {
					"application/json": {
						schema: resolver(modelResponseSchema),
					},
				},
			},
			400: {
				description: "Invalid model ID",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			404: {
				description: "Model not found",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			500: {
				description: "Server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("param", modelParamsSchema),
	async (context: Context) => {
		const { id } = context.req.valid("param" as never) as { id: string };
		const userId = context.get("user")?.id;
		try {
			const model = await getModelDetails(context.env as IEnv, id, userId);
			return ResponseFactory.success(context, {
				success: true,
				message: "Model fetched successfully",
				data: model,
			});
		} catch (_error) {
			return ResponseFactory.error(
				context,
				"Model not found or user does not have access",
				404,
			);
		}
	},
);

export default app;
