import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import type { IEnv } from "~/types";
import { TaskService } from "~/services/tasks/TaskService";
import {
	createPublicTaskRequestSchema,
	triggerMemorySynthesisRequestSchema,
} from "@assistant/schemas";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "routes/tasks" });

const app = new Hono<{ Bindings: IEnv }>();

addRoute(app, "get", "/", {
	tags: ["tasks"],
	summary: "Get all tasks for the authenticated user",
	auth: true,
	handler: async ({ raw, serviceContext, user }) => {
		try {
			const tasks = await serviceContext.repositories.tasks.getTasksByUserId(user.id);

			return {
				tasks,
				total: tasks.length,
			};
		} catch (error) {
			logger.error("Error fetching tasks:", error);
			return raw.json({ error: "Failed to fetch tasks" }, 500);
		}
	},
});

addRoute(app, "get", "/:id", {
	tags: ["tasks"],
	summary: "Get a specific task by ID",
	auth: true,
	handler: async ({ raw, serviceContext, user }) => {
		try {
			const taskId = raw.req.param("id");
			const task = await serviceContext.repositories.tasks.getTaskById(taskId);

			if (!task) {
				return raw.json({ error: "Task not found" }, 404);
			}

			if (task.user_id !== user.id) {
				return raw.json({ error: "Unauthorized" }, 403);
			}

			const executions = await serviceContext.repositories.tasks.getTaskExecutions(taskId);

			return {
				task,
				executions,
			};
		} catch (error) {
			logger.error("Error fetching task:", error);
			return raw.json({ error: "Failed to fetch task" }, 500);
		}
	},
});

addRoute(app, "post", "/memory-synthesis", {
	tags: ["tasks"],
	summary: "Create a memory synthesis task",
	auth: true,
	bodySchema: triggerMemorySynthesisRequestSchema,
	handler: async ({ body, raw, serviceContext, user }) => {
		try {
			const taskService = new TaskService(serviceContext.env, serviceContext.repositories.tasks);

			const taskId = await taskService.enqueueTask({
				task_type: "memory_synthesis",
				user_id: user.id,
				task_data: { namespace: body.namespace || "global" },
				priority: 7,
			});

			return {
				task_id: taskId,
				status: "queued",
				message: "Memory synthesis task queued successfully",
			};
		} catch (error) {
			logger.error("Error triggering memory synthesis:", error);
			return raw.json({ error: "Failed to trigger memory synthesis" }, 500);
		}
	},
});

addRoute(app, "post", "/", {
	tags: ["tasks"],
	summary: "Create a new task",
	auth: true,
	bodySchema: createPublicTaskRequestSchema,
	handler: async ({ body, raw, serviceContext, user }) => {
		try {
			const taskService = new TaskService(serviceContext.env, serviceContext.repositories.tasks);

			const taskId = await taskService.enqueueTask({
				task_type: body.task_type,
				user_id: user.id,
				task_data: body.task_data,
				schedule_type: body.schedule_type,
				scheduled_at: body.scheduled_at,
				priority: body.priority,
				metadata: body.metadata,
			});

			return {
				task_id: taskId,
				status: "queued",
				message: "Task created successfully",
			};
		} catch (error) {
			logger.error("Error creating task:", error);
			return raw.json({ error: "Failed to create task" }, 500);
		}
	},
});

addRoute(app, "delete", "/:id", {
	tags: ["tasks"],
	summary: "Delete a task by ID",
	auth: true,
	handler: async ({ raw, serviceContext, user }) => {
		try {
			const taskId = raw.req.param("id");
			const task = await serviceContext.repositories.tasks.getTaskById(taskId);

			if (!task) {
				return raw.json({ error: "Task not found" }, 404);
			}

			if (task.user_id !== user.id) {
				return raw.json({ error: "Unauthorized" }, 403);
			}

			const taskService = new TaskService(serviceContext.env, serviceContext.repositories.tasks);
			const cancelled = await taskService.cancelTask(taskId);

			if (!cancelled) {
				return raw.json({ error: "Task cannot be cancelled" }, 400);
			}

			return {
				message: "Task cancelled successfully",
			};
		} catch (error) {
			logger.error("Error cancelling task:", error);
			return raw.json({ success: false, error: "Failed to cancel task" }, 500);
		}
	},
});

addRoute(app, "get", "/memory/synthesis", {
	tags: ["tasks"],
	summary: "Get an active memory synthesis for a namespace",
	auth: true,
	handler: async ({ raw, serviceContext, user }) => {
		try {
			const namespace = raw.req.query("namespace") || "global";

			const synthesis = await serviceContext.repositories.memorySyntheses.getActiveSynthesis(
				user.id,
				namespace,
			);

			return {
				synthesis: synthesis || null,
			};
		} catch (error) {
			logger.error("Error fetching memory synthesis:", error);
			return raw.json({ error: "Failed to fetch memory synthesis" }, 500);
		}
	},
});

addRoute(app, "get", "/memory/syntheses", {
	tags: ["tasks"],
	summary: "Get memory syntheses for the authenticated user",
	auth: true,
	handler: async ({ raw, serviceContext, user }) => {
		try {
			const namespace = raw.req.query("namespace");
			const limit = Number.parseInt(raw.req.query("limit") || "10");

			const syntheses = await serviceContext.repositories.memorySyntheses.getSynthesesByUserId(
				user.id,
				namespace,
				limit,
			);

			return {
				syntheses,
				total: syntheses.length,
			};
		} catch (error) {
			logger.error("Error fetching memory syntheses:", error);
			return raw.json({ error: "Failed to fetch memory syntheses" }, 500);
		}
	},
});

export default app;
