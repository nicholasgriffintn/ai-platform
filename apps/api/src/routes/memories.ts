import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import z from "zod/v4";

import type { IEnv, IRequest } from "~/types";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { errorResponseSchema } from "./schemas/shared";
import { handleCreateMemoryGroup } from "~/services/memories/createGroup";
import { handleListMemories } from "~/services/memories/listMemories";
import { handleAddMemoriesToGroup } from "~/services/memories/addMemoriesToGroup";
import { handleDeleteMemory } from "~/services/memories/deleteMemory";
import { handleDeleteGroup } from "~/services/memories/deleteGroup";

const app = new Hono();
const routeLogger = createRouteLogger("memories");

app.get(
  "/",
  describeRoute({
    tags: ["memories"],
    summary: "List user memories",
    description:
      "Get all memories for the authenticated user, optionally filtered by group",
    responses: {
      200: {
        description: "List of user memories",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                memories: z.array(
                  z.object({
                    id: z.string(),
                    text: z.string(),
                    category: z.string(),
                    created_at: z.string(),
                    group_id: z.string().nullable(),
                    group_title: z.string().nullable(),
                  }),
                ),
                groups: z.array(
                  z.object({
                    id: z.string(),
                    title: z.string(),
                    description: z.string().nullable(),
                    category: z.string().nullable(),
                    member_count: z.number(),
                    created_at: z.string(),
                  }),
                ),
              }),
            ),
          },
        },
      },
      401: {
        description: "Authentication error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    try {
      const userContext = context.get("user");
      const groupId = context.req.query("group_id");

      if (!userContext) {
        return context.json({ error: "User not authenticated" }, 401);
      }

      const result = await handleListMemories(
        context.env as IEnv,
        userContext,
        groupId,
      );

      return context.json(result);
    } catch (error) {
      routeLogger.error("Failed to list memories", { error });
      return context.json({ error: "Failed to retrieve memories" }, 500);
    }
  },
);

app.post(
  "/groups",
  describeRoute({
    tags: ["memories"],
    summary: "Create memory group",
    description: "Create a new group for organizing memories",
    responses: {
      201: {
        description: "Group created successfully",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                id: z.string(),
                title: z.string(),
                description: z.string().nullable(),
                category: z.string().nullable(),
                created_at: z.string(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      category: z
        .enum(["fact", "preference", "schedule", "general", "snapshot"])
        .optional(),
    }),
  ),
  async (context: Context) => {
    try {
      const userContext = context.get("user");
      const body = context.req.valid("json" as never) as {
        title: string;
        description?: string;
        category?: string;
      };

      if (!userContext) {
        return context.json({ error: "User not authenticated" }, 401);
      }

      const result = await handleCreateMemoryGroup(
        context.env as IEnv,
        userContext,
        body.title,
        body.description,
        body.category,
      );

      return context.json(result, 201);
    } catch (error) {
      routeLogger.error("Failed to create memory group", { error });
      return context.json({ error: "Failed to create group" }, 500);
    }
  },
);

app.post(
  "/groups/:group_id/memories",
  describeRoute({
    tags: ["memories"],
    summary: "Add memories to group",
    description: "Manually add specific memories to a group",
    responses: {
      200: {
        description: "Memories added to group",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
                added_count: z.number(),
              }),
            ),
          },
        },
      },
      404: {
        description: "Group not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator(
    "json",
    z.object({
      memory_ids: z.array(z.string()).min(1),
    }),
  ),
  async (context: Context) => {
    try {
      const userContext = context.get("user");
      const groupId = context.req.param("group_id");
      const body = context.req.valid("json" as never) as {
        memory_ids: string[];
      };

      if (!userContext) {
        return context.json({ error: "User not authenticated" }, 401);
      }

      const result = await handleAddMemoriesToGroup(
        context.env as IEnv,
        userContext,
        groupId,
        body.memory_ids,
      );

      return context.json(result);
    } catch (error) {
      routeLogger.error("Failed to add memories to group", { error });
      return context.json({ error: "Failed to add memories to group" }, 500);
    }
  },
);

app.delete(
  "/:memory_id",
  describeRoute({
    tags: ["memories"],
    summary: "Delete a memory",
    description: "Delete a specific memory for the authenticated user",
    responses: {
      200: {
        description: "Memory deleted successfully",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
                deleted_from_groups: z.number(),
              }),
            ),
          },
        },
      },
      404: {
        description: "Memory not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    try {
      const userContext = context.get("user");
      const memoryId = context.req.param("memory_id");

      if (!userContext) {
        return context.json({ error: "User not authenticated" }, 401);
      }

      const result = await handleDeleteMemory(
        context.env as IEnv,
        userContext,
        memoryId,
      );

      return context.json(result);
    } catch (error) {
      routeLogger.error("Failed to delete memory", { error });
      return context.json({ error: "Failed to delete memory" }, 500);
    }
  },
);

app.delete(
  "/groups/:group_id",
  describeRoute({
    tags: ["memories"],
    summary: "Delete a memory group",
    description: "Delete a specific memory group for the authenticated user",
    responses: {
      200: {
        description: "Group deleted successfully",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
              }),
            ),
          },
        },
      },
      404: {
        description: "Group not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    try {
      const userContext = context.get("user");
      const groupId = context.req.param("group_id");

      if (!userContext) {
        return context.json({ error: "User not authenticated" }, 401);
      }

      const result = await handleDeleteGroup(
        context.env as IEnv,
        userContext,
        groupId,
      );

      return context.json(result);
    } catch (error) {
      routeLogger.error("Failed to delete group", { error });
      return context.json({ error: "Failed to delete group" }, 500);
    }
  },
);

export default app;
