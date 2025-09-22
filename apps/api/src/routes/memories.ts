import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import {
  errorResponseSchema,
  memoryListResponseSchema,
  memoryGroupResponseSchema,
  memoryGroupCreateSchema,
  memoryGroupAddSchema,
  memoryOperationResponseSchema,
} from "@assistant/schemas";

import type { IEnv, IRequest } from "~/types";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
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
            schema: resolver(memoryListResponseSchema),
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
            schema: resolver(memoryGroupResponseSchema),
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
  zValidator("json", memoryGroupCreateSchema),
  async (context: Context) => {
    try {
      const userContext = context.get("user");
      const { title, description, category } = context.req.valid(
        "json" as never,
      ) as {
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
        title,
        description,
        category,
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
            schema: resolver(memoryOperationResponseSchema),
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
  zValidator("json", memoryGroupAddSchema),
  async (context: Context) => {
    try {
      const userContext = context.get("user");
      const groupId = context.req.param("group_id");
      const { memory_ids } = context.req.valid("json" as never) as {
        memory_ids: string[];
      };

      if (!userContext) {
        return context.json({ error: "User not authenticated" }, 401);
      }

      const result = await handleAddMemoriesToGroup(
        context.env as IEnv,
        userContext,
        groupId,
        memory_ids,
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
            schema: resolver(memoryOperationResponseSchema),
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
            schema: resolver(memoryOperationResponseSchema),
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
