import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	errorResponseSchema,
	memoryListResponseSchema,
	memoryGroupResponseSchema,
	memoryGroupCreateSchema,
	memoryGroupAddSchema,
	memoryOperationResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { handleCreateMemoryGroup } from "~/services/memories/createGroup";
import { handleListMemories } from "~/services/memories/listMemories";
import { handleAddMemoriesToGroup } from "~/services/memories/addMemoriesToGroup";
import { handleDeleteMemory } from "~/services/memories/deleteMemory";
import { handleDeleteGroup } from "~/services/memories/deleteGroup";

const app = new Hono();
const routeLogger = createRouteLogger("memories");

addRoute(app, "get", "/", {
	tags: ["memories"],
	summary: "List user memories",
	description:
		"Get all memories for the authenticated user, optionally filtered by group",
	responses: {
		200: {
			description: "List of user memories",
			schema: memoryListResponseSchema,
		},
		401: { description: "Authentication error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			try {
				const userContext = context.get("user");
				const groupId = context.req.query("group_id");

				if (!userContext) {
					return ResponseFactory.error(context, "User not authenticated", 401);
				}

				const serviceContext = getServiceContext(context);

				const result = await handleListMemories(serviceContext, groupId);

				return ResponseFactory.success(context, result);
			} catch (error) {
				routeLogger.error("Failed to list memories", { error });
				return ResponseFactory.error(
					context,
					"Failed to retrieve memories",
					500,
				);
			}
		})(raw),
});

addRoute(app, "post", "/groups", {
	tags: ["memories"],
	summary: "Create memory group",
	description: "Create a new group for organizing memories",
	bodySchema: memoryGroupCreateSchema,
	responses: {
		201: {
			description: "Group created successfully",
			schema: memoryGroupResponseSchema,
		},
		400: { description: "Bad request", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
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
					return ResponseFactory.error(context, "User not authenticated", 401);
				}

				const serviceContext = getServiceContext(context);

				const result = await handleCreateMemoryGroup(
					serviceContext,
					title,
					description,
					category,
				);

				return ResponseFactory.success(context, result, 201);
			} catch (error) {
				routeLogger.error("Failed to create memory group", { error });
				return ResponseFactory.error(context, "Failed to create group", 500);
			}
		})(raw),
});

addRoute(app, "post", "/groups/:group_id/memories", {
	tags: ["memories"],
	summary: "Add memories to group",
	description: "Manually add specific memories to a group",
	bodySchema: memoryGroupAddSchema,
	responses: {
		200: {
			description: "Memories added to group",
			schema: memoryOperationResponseSchema,
		},
		404: { description: "Group not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			try {
				const userContext = context.get("user");
				const groupId = context.req.param("group_id");
				const { memory_ids } = context.req.valid("json" as never) as {
					memory_ids: string[];
				};

				if (!userContext) {
					return ResponseFactory.error(context, "User not authenticated", 401);
				}

				const serviceContext = getServiceContext(context);

				const result = await handleAddMemoriesToGroup(
					serviceContext,
					groupId,
					memory_ids,
				);

				return ResponseFactory.success(context, result);
			} catch (error) {
				routeLogger.error("Failed to add memories to group", { error });
				return ResponseFactory.error(
					context,
					"Failed to add memories to group",
					500,
				);
			}
		})(raw),
});

addRoute(app, "delete", "/:memory_id", {
	tags: ["memories"],
	summary: "Delete a memory",
	description: "Delete a specific memory for the authenticated user",
	responses: {
		200: {
			description: "Memory deleted successfully",
			schema: memoryOperationResponseSchema,
		},
		404: { description: "Memory not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			try {
				const userContext = context.get("user");
				const memoryId = context.req.param("memory_id");

				if (!userContext) {
					return ResponseFactory.error(context, "User not authenticated", 401);
				}

				const serviceContext = getServiceContext(context);

				const result = await handleDeleteMemory(serviceContext, memoryId);

				return ResponseFactory.success(context, result);
			} catch (error) {
				routeLogger.error("Failed to delete memory", { error });
				return ResponseFactory.error(context, "Failed to delete memory", 500);
			}
		})(raw),
});

addRoute(app, "delete", "/groups/:group_id", {
	tags: ["memories"],
	summary: "Delete a memory group",
	description: "Delete a specific memory group for the authenticated user",
	responses: {
		200: {
			description: "Group deleted successfully",
			schema: memoryOperationResponseSchema,
		},
		404: { description: "Group not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			try {
				const userContext = context.get("user");
				const groupId = context.req.param("group_id");

				if (!userContext) {
					return ResponseFactory.error(context, "User not authenticated", 401);
				}

				const serviceContext = getServiceContext(context);

				const result = await handleDeleteGroup(serviceContext, groupId);

				return ResponseFactory.success(context, result);
			} catch (error) {
				routeLogger.error("Failed to delete group", { error });
				return ResponseFactory.error(context, "Failed to delete group", 500);
			}
		})(raw),
});

export default app;
