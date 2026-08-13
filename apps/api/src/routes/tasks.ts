import { Hono } from "hono";
import z from "zod/v4";
import {
	createPublicTaskRequestSchema,
	createTaskResponseSchema,
	listTasksResponseSchema,
	triggerMemorySynthesisRequestSchema,
} from "@ngriffin_uk/polychat-schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import {
	cancelUserTask,
	createMemorySynthesisTask,
	createUserTask,
	getActiveMemorySynthesis,
	getUserTask,
	listMemorySyntheses,
	listUserTasks,
} from "~/services/tasks";

const app = new Hono();
const params = z.object({ id: z.string().min(1) });
const synthesisQuerySchema = z.object({ namespace: z.string().optional() });
const synthesesQuerySchema = z.object({
	namespace: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(50).default(10),
});

addRoute(app, "get", "/", {
	tags: ["tasks"],
	summary: "Get all tasks for the authenticated user",
	auth: true,
	responses: { 200: { description: "Tasks", schema: listTasksResponseSchema } },
	handler: ({ serviceContext, user }) => listUserTasks(serviceContext, user.id),
});

addRoute(app, "post", "/memory-synthesis", {
	tags: ["tasks"],
	summary: "Create a memory synthesis task",
	auth: true,
	bodySchema: triggerMemorySynthesisRequestSchema,
	responses: { 200: { description: "Queued task", schema: createTaskResponseSchema } },
	handler: ({ body, serviceContext, user }) =>
		createMemorySynthesisTask(serviceContext, user.id, body),
});

addRoute(app, "post", "/", {
	tags: ["tasks"],
	summary: "Create a new task",
	auth: true,
	bodySchema: createPublicTaskRequestSchema,
	responses: { 200: { description: "Queued task", schema: createTaskResponseSchema } },
	handler: ({ body, serviceContext, user }) => createUserTask(serviceContext, user.id, body),
});

addRoute(app, "get", "/memory/synthesis", {
	tags: ["tasks"],
	summary: "Get an active memory synthesis for a namespace",
	auth: true,
	querySchema: synthesisQuerySchema,
	handler: ({ query, serviceContext, user }) =>
		getActiveMemorySynthesis(serviceContext, user.id, query.namespace || "global"),
});

addRoute(app, "get", "/memory/syntheses", {
	tags: ["tasks"],
	summary: "Get memory syntheses for the authenticated user",
	auth: true,
	querySchema: synthesesQuerySchema,
	handler: ({ query, serviceContext, user }) => listMemorySyntheses(serviceContext, user.id, query),
});

addRoute(app, "get", "/:id", {
	tags: ["tasks"],
	summary: "Get a specific task by ID",
	auth: true,
	paramSchema: params,
	handler: ({ params, serviceContext, user }) => getUserTask(serviceContext, user.id, params.id),
});

addRoute(app, "delete", "/:id", {
	tags: ["tasks"],
	summary: "Delete a task by ID",
	auth: true,
	paramSchema: params,
	handler: ({ params, serviceContext, user }) => cancelUserTask(serviceContext, user.id, params.id),
});

export default app;
