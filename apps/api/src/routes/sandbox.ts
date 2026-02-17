import { type Context, Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import {
	executeSandboxWorkerProxySchema,
	type ExecuteSandboxWorkerProxyPayload,
} from "@assistant/schemas";

import { requireAuth } from "~/middleware/auth";
import { requirePlan } from "~/middleware/requirePlan";
import { getServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxWorker } from "~/services/sandbox/worker";

const sandbox = new Hono();
sandbox.use("*", requireAuth);
sandbox.use("*", requirePlan("pro"));

sandbox.post(
	"/execute",
	zValidator("json", executeSandboxWorkerProxySchema),
	async (c: Context) => {
		const ctx = getServiceContext(c);
		const user = ctx.requireUser();
		const payload = c.req.valid(
			"json" as never,
		) as ExecuteSandboxWorkerProxyPayload;

		if (!c.env.SANDBOX_WORKER) {
			return c.json({ error: "Sandbox not available" }, 503);
		}

		const response = await executeSandboxWorker({
			env: c.env,
			context: ctx,
			user,
			repo: payload.repo,
			task: payload.task,
			taskType: payload.taskType,
			model: payload.model,
			promptStrategy: payload.promptStrategy,
			shouldCommit: Boolean(payload.shouldCommit),
			timeoutSeconds: payload.timeoutSeconds,
			installationId: payload.installationId,
			stream: c.req.header("accept")?.includes("text/event-stream"),
			runId: payload.runId,
		});

		return response;
	},
);

export default sandbox;
