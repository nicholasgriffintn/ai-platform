import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import {
	availableCapabilities,
	availableModelTypes,
	getModelConfig,
	getModels,
	getModelsByCapability,
	getModelsByType,
} from "../lib/models";
import { createRouteLogger } from "../middleware/loggerMiddleware";

const app = new Hono();

const routeLogger = createRouteLogger("MODELS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
	routeLogger.info(`Processing models route: ${c.req.path}`);
	return next();
});

app.get(
	"/",
	describeRoute({
		tags: ["models"],
		title: "List models",
		description:
			"Lists the currently available models, and provides basic information about each one such as the capabilities and pricing.",
	}),
	async (context: Context) => {
		const models = getModels();

		return context.json({
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
		title: "Get all capabilities",
	}),
	async (context: Context) => {
		return context.json({
			success: true,
			message: "Capabilities fetched successfully",
			data: availableCapabilities,
		});
	},
);

app.get(
	"/capabilities/:capability",
	describeRoute({
		tags: ["models"],
		title: "Get models by capability",
	}),
	zValidator(
		"param",
		z.object({
			capability: z.string(),
		}),
	),
	async (context: Context) => {
		const { capability } = context.req.valid("param" as never) as {
			capability: string;
		};

		const models = getModelsByCapability(capability);

		return context.json({
			success: true,
			message: "Models fetched successfully",
			data: models,
		});
	},
);

app.get(
	"/types",
	describeRoute({
		tags: ["models"],
		title: "Get all model types",
	}),
	async (context: Context) => {
		return context.json({
			success: true,
			message: "Model types fetched successfully",
			data: availableModelTypes,
		});
	},
);

app.get(
	"/types/:type",
	describeRoute({
		tags: ["models"],
		title: "Get models by type",
	}),
	zValidator(
		"param",
		z.object({
			type: z.string(),
		}),
	),
	async (context: Context) => {
		const { type } = context.req.valid("param" as never) as { type: string };

		const models = getModelsByType(type);

		return context.json({
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
		title: "Retrieve model",
		description:
			"Retrieves a model instance, providing basic information about the model.",
	}),
	zValidator(
		"param",
		z.object({
			id: z.string(),
		}),
	),
	async (context: Context) => {
		const { id } = context.req.valid("param" as never) as { id: string };

		const model = getModelConfig(id);

		return context.json({
			success: true,
			message: "Model fetched successfully",
			data: model,
		});
	},
);

export default app;
