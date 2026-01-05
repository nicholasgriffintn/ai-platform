import { Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";

import type { IEnv } from "~/types";
import { requireAuth } from "~/middleware/auth";
import { getServiceContext } from "~/lib/context/serviceContext";
import { TaskService } from "~/services/tasks/TaskService";
import {
	CreateTaskRequest,
	TriggerMemorySynthesisRequest,
} from "@assistant/schemas";
import { getLogger } from "~/utils/logger";
import { ResponseFactory } from "../lib/http/ResponseFactory";

const logger = getLogger({ prefix: "routes/tasks" });

const app = new Hono<{ Bindings: IEnv }>();

app.use("*", requireAuth);

app.get(
	"/",
	describeRoute({
		tags: ["tasks"],
		summary: "Get all tasks for the authenticated user",
	}),
	async (c) => {
		try {
			const { user, repositories } = getServiceContext(c);

			const tasks = await repositories.tasks.getTasksByUserId(user.id);

			return c.json({
				tasks,
				total: tasks.length,
			});
		} catch (error) {
			logger.error("Error fetching tasks:", error);
			return c.json({ error: "Failed to fetch tasks" }, 500);
		}
	},
);

app.get(
	"/:id",
	describeRoute({
		tags: ["tasks"],
		summary: "Get a specific task by ID",
	}),
	async (c) => {
		try {
			const { user, repositories } = getServiceContext(c);
			const taskId = c.req.param("id");

			const task = await repositories.tasks.getTaskById(taskId);

			if (!task) {
				return c.json({ error: "Task not found" }, 404);
			}

			if (task.user_id && task.user_id !== user.id) {
				return c.json({ error: "Unauthorized" }, 403);
			}

			const executions = await repositories.tasks.getTaskExecutions(taskId);

			return c.json({
				task,
				executions,
			});
		} catch (error) {
			logger.error("Error fetching task:", error);
			return c.json({ error: "Failed to fetch task" }, 500);
		}
	},
);

app.post(
	"/memory-synthesis",
	describeRoute({
		tags: ["tasks"],
		summary: "Create a memory synthesis task",
	}),
	zValidator("json", TriggerMemorySynthesisRequest),
	async (c) => {
		try {
			const { user, env, repositories } = getServiceContext(c);
			const body = c.req.valid("json");

			const taskService = new TaskService(env, repositories.tasks);

			const taskId = await taskService.enqueueTask({
				task_type: "memory_synthesis",
				user_id: user.id,
				task_data: { namespace: body.namespace || "global" },
				priority: 7,
			});

			return c.json({
				task_id: taskId,
				status: "queued",
				message: "Memory synthesis task queued successfully",
			});
		} catch (error) {
			logger.error("Error triggering memory synthesis:", error);
			return c.json({ error: "Failed to trigger memory synthesis" }, 500);
		}
	},
);

app.post(
	"/",
	describeRoute({
		tags: ["tasks"],
		summary: "Create a new task",
	}),
	zValidator("json", CreateTaskRequest),
	async (c) => {
		try {
			const { user, env, repositories } = getServiceContext(c);
			const body = c.req.valid("json");

			const taskService = new TaskService(env, repositories.tasks);

			const taskId = await taskService.enqueueTask({
				task_type: body.task_type,
				user_id: user.id,
				task_data: body.task_data,
				schedule_type: body.schedule_type,
				scheduled_at: body.scheduled_at,
				priority: body.priority,
				metadata: body.metadata,
			});

			return c.json({
				task_id: taskId,
				status: "queued",
				message: "Task created successfully",
			});
		} catch (error) {
			logger.error("Error creating task:", error);
			return c.json({ error: "Failed to create task" }, 500);
		}
	},
);

app.delete(
	"/:id",
	describeRoute({
		tags: ["tasks"],
		summary: "Delete a task by ID",
	}),
	async (c) => {
		try {
			const { user, env, repositories } = getServiceContext(c);
			const taskId = c.req.param("id");

			const task = await repositories.tasks.getTaskById(taskId);

			if (!task) {
				return c.json({ error: "Task not found" }, 404);
			}

			if (task.user_id !== user.id) {
				return c.json({ error: "Unauthorized" }, 403);
			}

			const taskService = new TaskService(env, repositories.tasks);
			const cancelled = await taskService.cancelTask(taskId);

			if (!cancelled) {
				return c.json({ error: "Task cannot be cancelled" }, 400);
			}

			return ResponseFactory.success(c, {
				message: "Task cancelled successfully",
			});
		} catch (error) {
			logger.error("Error cancelling task:", error);
			return c.json({ success: false, error: "Failed to cancel task" }, 500);
		}
	},
);

app.get(
	"/memory/synthesis",
	describeRoute({
		tags: ["tasks"],
		summary: "Get an active memory synthesis for a namespace",
	}),
	async (c) => {
		try {
			const { user, repositories } = getServiceContext(c);
			const namespace = c.req.query("namespace") || "global";

			const synthesis = await repositories.memorySyntheses.getActiveSynthesis(
				user.id,
				namespace,
			);

			return c.json({
				synthesis: synthesis || null,
			});
		} catch (error) {
			logger.error("Error fetching memory synthesis:", error);
			return c.json({ error: "Failed to fetch memory synthesis" }, 500);
		}
	},
);

app.get(
	"/memory/syntheses",
	describeRoute({
		tags: ["tasks"],
		summary: "Get memory syntheses for the authenticated user",
	}),
	async (c) => {
		try {
			const { user, repositories } = getServiceContext(c);
			const namespace = c.req.query("namespace");
			const limit = Number.parseInt(c.req.query("limit") || "10");

			const syntheses = await repositories.memorySyntheses.getSynthesesByUserId(
				user.id,
				namespace,
				limit,
			);

			return c.json({
				syntheses,
				total: syntheses.length,
			});
		} catch (error) {
			logger.error("Error fetching memory syntheses:", error);
			return c.json({ error: "Failed to fetch memory syntheses" }, 500);
		}
	},
);

export default app;
