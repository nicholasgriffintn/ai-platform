import { type Context, Hono } from "hono";

import { requireAuth } from "~/middleware/auth";
import { requirePlan } from "~/middleware/requirePlan";
import { getServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxWorker } from "~/services/sandbox/worker";

const sandbox = new Hono();
sandbox.use("*", requireAuth);
sandbox.use("*", requirePlan("pro"));

sandbox.post("/execute", async (c: Context) => {
	const ctx = getServiceContext(c);
	const user = ctx.requireUser();
	let body: Record<string, unknown>;
	try {
		body = (await c.req.json()) as Record<string, unknown>;
	} catch {
		return c.json({ error: "Invalid JSON body" }, 400);
	}

	if (!c.env.SANDBOX_WORKER) {
		return c.json({ error: "Sandbox not available" }, 503);
	}

	if (body.model !== undefined && typeof body.model !== "string") {
		return c.json({ error: "model must be a string" }, 400);
	}
	if (typeof body.repo !== "string" || !body.repo.trim()) {
		return c.json({ error: "repo must be a non-empty string" }, 400);
	}
	if (typeof body.task !== "string" || !body.task.trim()) {
		return c.json({ error: "task must be a non-empty string" }, 400);
	}

	const installationId =
		typeof body.installationId === "number" &&
		Number.isFinite(body.installationId)
			? body.installationId
			: undefined;

	const response = await executeSandboxWorker({
		env: c.env,
		context: ctx,
		user,
		repo: body.repo,
		task: body.task,
		taskType: typeof body.taskType === "string" ? body.taskType : undefined,
		model: typeof body.model === "string" ? body.model : undefined,
		shouldCommit: Boolean(body.shouldCommit),
		installationId,
		stream: c.req.header("accept")?.includes("text/event-stream"),
		runId: typeof body.runId === "string" ? body.runId : undefined,
	});

	return response;
});

export default sandbox;
