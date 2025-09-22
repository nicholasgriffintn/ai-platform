import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  getModelDetails,
  listCapabilities,
  listModelTypes,
  listModels,
  listModelsByCapability,
  listModelsByType,
} from "~/services/models";
import type { IEnv } from "~/types";
import {
  capabilitiesResponseSchema,
  capabilityParamsSchema,
  modelParamsSchema,
  modelResponseSchema,
  modelsResponseSchema,
  typeParamsSchema,
} from "./schemas/models";
import { errorResponseSchema } from "./schemas/shared";

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
    const caps = listCapabilities();
    return context.json({
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
    const userId = context.get("user")?.id;
    const models = await listModelsByCapability(
      context.env as IEnv,
      capability,
      userId,
    );
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
    summary: "Get all model types",
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
    const types = listModelTypes();
    return context.json({
      success: true,
      message: "Model types fetched successfully",
      data: types,
    });
  },
);

app.get(
  "/types/:type",
  describeRoute({
    tags: ["models"],
    summary: "Get models by type",
    description: "Returns all models of a specific type",
    parameters: [
      {
        name: "type",
        in: "path",
        required: true,
        schema: { type: "string" },
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
  zValidator("param", typeParamsSchema),
  async (context: Context) => {
    const { type } = context.req.valid("param" as never) as { type: string };
    const userId = context.get("user")?.id;
    const models = await listModelsByType(context.env as IEnv, type, userId);
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
      return context.json({
        success: true,
        message: "Model fetched successfully",
        data: model,
      });
    } catch (_error) {
      return context.json(
        {
          success: false,
          message: "Model not found or user does not have access",
        },
        404,
      );
    }
  },
);

export default app;
