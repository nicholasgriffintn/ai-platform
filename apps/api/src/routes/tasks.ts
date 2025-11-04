import { Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import type { IEnv } from "~/types";
import { requireAuth } from "~/middleware/auth";
import { getServiceContext } from "~/lib/context/serviceContext";
import { TaskService } from "~/services/tasks/TaskService";
import {
	CreateTaskRequest,
	TriggerMemorySynthesisRequest,
} from "@assistant/schemas";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "routes/tasks" });

const app = new Hono<{ Bindings: IEnv }>();

// Apply auth middleware to all routes
app.use("*", requireAuth);

/**
 * GET /tasks
 * List user's tasks
 */
app.get("/", async (c) => {
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
});

/**
 * GET /tasks/:id
 * Get task status
 */
app.get("/:id", async (c) => {
	try {
		const { user, repositories } = getServiceContext(c);
		const taskId = c.req.param("id");

		const task = await repositories.tasks.getTaskById(taskId);

		if (!task) {
			return c.json({ error: "Task not found" }, 404);
		}

		// Ensure user owns the task or it's a system task
		if (task.user_id && task.user_id !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		// Get task executions
		const executions = await repositories.tasks.getTaskExecutions(taskId);

		return c.json({
			task,
			executions,
		});
	} catch (error) {
		logger.error("Error fetching task:", error);
		return c.json({ error: "Failed to fetch task" }, 500);
	}
});

/**
 * POST /tasks/memory-synthesis
 * Manually trigger memory synthesis
 */
app.post(
	"/memory-synthesis",
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
				priority: 7, // Higher priority for manual triggers
			});

			return c.json({
				task_id: taskId,
				status: "queued",
				message: "Memory synthesis task queued successfully",
			});
		} catch (error) {
			logger.error("Error triggering memory synthesis:", error);
			return c.json(
				{ error: "Failed to trigger memory synthesis" },
				500,
			);
		}
	},
);

/**
 * POST /tasks
 * Create a new task (generic endpoint)
 */
app.post("/", zValidator("json", CreateTaskRequest), async (c) => {
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
});

/**
 * DELETE /tasks/:id
 * Cancel a task
 */
app.delete("/:id", async (c) => {
	try {
		const { user, env, repositories } = getServiceContext(c);
		const taskId = c.req.param("id");

		const task = await repositories.tasks.getTaskById(taskId);

		if (!task) {
			return c.json({ error: "Task not found" }, 404);
		}

		// Ensure user owns the task
		if (task.user_id !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		const taskService = new TaskService(env, repositories.tasks);
		const cancelled = await taskService.cancelTask(taskId);

		if (!cancelled) {
			return c.json({ error: "Task cannot be cancelled" }, 400);
		}

		return c.json({
			message: "Task cancelled successfully",
		});
	} catch (error) {
		logger.error("Error cancelling task:", error);
		return c.json({ error: "Failed to cancel task" }, 500);
	}
});

/**
 * GET /memory/synthesis
 * Get active memory synthesis
 */
app.get("/memory/synthesis", async (c) => {
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
});

/**
 * GET /memory/syntheses
 * Get all memory syntheses for the user
 */
app.get("/memory/syntheses", async (c) => {
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
});

export default app;
