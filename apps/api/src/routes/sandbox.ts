import { type Context, Hono } from "hono";

import { requireAuth } from "~/middleware/auth";
import { getServiceContext } from "~/lib/context/serviceContext";
import { generateJwtToken } from "~/services/auth/jwt";

const sandbox = new Hono();
sandbox.use("*", requireAuth);

sandbox.post("/execute", async (c: Context) => {
	const ctx = getServiceContext(c);
	const user = ctx.requireUser();
	const body = await c.req.json();

	if (!c.env.SANDBOX_WORKER) {
		return c.json({ error: "Sandbox not available" }, 503);
	}

	const settings = await ctx.repositories.userSettings.getUserSettings(user.id);
	const model = body.model || settings?.sandbox_model;

	if (!model) {
		return c.json(
			{
				error:
					"No model specified. Provide a model or configure one in settings.",
			},
			400,
		);
	}

	const expiresIn = 60 * 60;
	const sandboxToken = await generateJwtToken(
		user,
		c.env.JWT_SECRET,
		expiresIn,
	);

	const response = await c.env.SANDBOX_WORKER.fetch(
		new Request("http://sandbox/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				userId: user.id,
				taskType: body.taskType,
				repo: body.repo,
				task: body.task,
				model,
				userToken: sandboxToken,
				polychatApiUrl: "https://api.polychat.app",
			}),
		}),
	);

	return response;
});

export default sandbox;
