import { type Context, Hono } from "hono";

import { requireAuth } from "~/middleware/auth";
import { getServiceContext } from "~/lib/context/serviceContext";
import { generateJwtToken } from "~/services/auth/jwt";
import { getGitHubAppInstallationToken } from "~/lib/github";
import { getGitHubAppConnectionForUserRepo } from "~/services/github/connections";

const sandbox = new Hono();
sandbox.use("*", requireAuth);

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

	const settings = await ctx.repositories.userSettings.getUserSettings(user.id);
	const model =
		(typeof body.model === "string" ? body.model : undefined) ||
		settings?.sandbox_model;

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

	const githubConnection = await getGitHubAppConnectionForUserRepo(
		ctx,
		user.id,
		body.repo,
	);
	const githubToken = await getGitHubAppInstallationToken({
		appId: githubConnection.appId,
		privateKey: githubConnection.privateKey,
		installationId: githubConnection.installationId,
	});

	const response = await c.env.SANDBOX_WORKER.fetch(
		new Request("http://sandbox/execute", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${sandboxToken}`,
				"X-GitHub-Token": githubToken,
			},
			body: JSON.stringify({
				userId: user.id,
				taskType: body.taskType,
				repo: body.repo,
				task: body.task,
				model,
				shouldCommit: Boolean(body.shouldCommit),
				polychatApiUrl:
					c.env.ENV === "production"
						? "https://api.polychat.app"
						: "http://localhost:8787",
			}),
		}),
	);

	return response;
});

export default sandbox;
