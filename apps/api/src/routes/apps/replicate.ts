import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import z from "zod/v4";
import { apiResponseSchema } from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { executeReplicateModel } from "~/services/apps/replicate/execute";
import { listReplicatePredictions } from "~/services/apps/replicate/list";
import { getReplicatePredictionDetails } from "~/services/apps/replicate/get-details";
import { replicateModelConfig } from "~/lib/models/replicate";
import type { IEnv, IUser } from "~/types";
import { AssistantError } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/replicate");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing replicate route: ${c.req.path}`);
  return next();
});

const executeReplicateSchema = z.object({
  modelId: z.string().min(1),
  input: z.record(z.string(), z.any()),
});

app.get(
  "/models",
  describeRoute({
    tags: ["apps", "replicate"],
    description: "List all available Replicate models",
    responses: {
      200: {
        description: "List of Replicate models",
        content: {
          "application/json": {
            schema: resolver(z.array(z.any())),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const models = Object.entries(replicateModelConfig).map(([id, model]) => ({
      id,
      name: model.name,
      description: model.description,
      type: model.type,
      costPerRun: model.costPerRun,
      inputSchema: model.replicateInputSchema,
    }));

    return context.json({ models });
  },
);

app.get(
  "/predictions",
  describeRoute({
    tags: ["apps", "replicate"],
    description: "List user's Replicate predictions",
    responses: {
      200: {
        description: "List of predictions",
        content: {
          "application/json": {
            schema: resolver(z.any()),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const user = context.get("user") as IUser;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    try {
      const predictions = await listReplicatePredictions(
        user.id,
        context.env as IEnv,
      );

      return context.json({
        predictions,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error fetching predictions:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to fetch predictions");
    }
  },
);

app.get(
  "/predictions/:id",
  describeRoute({
    tags: ["apps", "replicate"],
    description: "Get Replicate prediction details",
    responses: {
      200: {
        description: "Prediction details",
        content: {
          "application/json": {
            schema: resolver(z.any()),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const user = context.get("user") as IUser;
    const predictionId = context.req.param("id");

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    try {
      const prediction = await getReplicatePredictionDetails(
        predictionId,
        user.id,
        context.env as IEnv,
      );

      return context.json({
        prediction,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error fetching prediction:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to fetch prediction");
    }
  },
);

app.post(
  "/execute",
  describeRoute({
    tags: ["apps", "replicate"],
    description: "Execute a Replicate model",
    responses: {
      200: {
        description: "Execution result",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", executeReplicateSchema),
  async (context: Context) => {
    const user = context.get("user") as IUser;
    const body = context.req.valid("json" as never) as z.infer<
      typeof executeReplicateSchema
    >;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    try {
      const result = await executeReplicateModel({
        env: context.env as IEnv,
        params: body,
        user,
      });

      return context.json({
        response: result,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error executing model:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to execute model");
    }
  },
);

export default app;
