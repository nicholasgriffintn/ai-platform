import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import {
  availableCapabilities,
  availableModelTypes,
  filterModelsForUserAccess,
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
app.use("/*", (c: Context, next) => {
  routeLogger.info(`Processing models route: ${c.req.path}`);
  return next();
});

// Common response schemas
const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  context_length: z.number().optional(),
  pricing: z
    .object({
      prompt: z.number().optional(),
      completion: z.number().optional(),
    })
    .optional(),
  type: z.string().optional(),
});

const modelsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.record(z.string(), modelSchema),
});

const modelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: modelSchema,
});

const capabilitiesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(z.string()),
});

app.get(
  "/",
  describeRoute({
    tags: ["models"],
    title: "List models",
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
    const allModels = getModels();
    const filteredModels = await filterModelsForUserAccess(
      allModels,
      context.env,
      context.get("user")?.id,
    );

    return context.json({
      success: true,
      message: "Models fetched successfully",
      data: filteredModels,
    });
  },
);

app.get(
  "/capabilities",
  describeRoute({
    tags: ["models"],
    title: "Get all capabilities",
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
    description: "Returns all models that support a specific capability",
    parameters: [
      {
        name: "capability",
        in: "path",
        required: true,
        schema: z.string(),
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

    const modelsByCapability = getModelsByCapability(capability);
    const filteredModels = await filterModelsForUserAccess(
      modelsByCapability,
      context.env,
      context.get("user")?.id,
    );

    return context.json({
      success: true,
      message: "Models fetched successfully",
      data: filteredModels,
    });
  },
);

app.get(
  "/types",
  describeRoute({
    tags: ["models"],
    title: "Get all model types",
    description: "Returns a list of all available model types",
    responses: {
      200: {
        description: "List of all available model types",
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
    description: "Returns all models of a specific type",
    parameters: [
      {
        name: "type",
        in: "path",
        required: true,
        schema: z.string(),
        description: "Model type to filter by",
      },
    ],
    responses: {
      200: {
        description: "List of models of the specified type",
        content: {
          "application/json": {
            schema: resolver(modelsResponseSchema),
          },
        },
      },
      400: {
        description: "Invalid type parameter",
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
  zValidator(
    "param",
    z.object({
      type: z.string(),
    }),
  ),
  async (context: Context) => {
    const { type } = context.req.valid("param" as never) as { type: string };

    const modelsByType = getModelsByType(type);
    const filteredModels = await filterModelsForUserAccess(
      modelsByType,
      context.env,
      context.get("user")?.id,
    );

    return context.json({
      success: true,
      message: "Models fetched successfully",
      data: filteredModels,
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
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: z.string(),
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
  zValidator(
    "param",
    z.object({
      id: z.string(),
    }),
  ),
  async (context: Context) => {
    const { id } = context.req.valid("param" as never) as { id: string };

    const model = getModelConfig(id);

    const accessibleModels = await filterModelsForUserAccess(
      { [id]: model },
      context.env,
      context.get("user")?.id,
    );

    if (!accessibleModels[id]) {
      return context.json(
        {
          success: false,
          message: "Model not found or user does not have access",
        },
        404,
      );
    }

    return context.json({
      success: true,
      message: "Model fetched successfully",
      data: model,
    });
  },
);

export default app;
