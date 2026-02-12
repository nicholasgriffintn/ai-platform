import { executeFeatureImplementation } from "./tasks/feature-implementation";
import type { TaskParams, TaskSecrets, Env } from "./types";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname !== "/execute") {
			return Response.json({ error: "Not found" }, { status: 404 });
		}

		if (request.method !== "POST") {
			return Response.json({ error: "Method not allowed" }, { status: 405 });
		}

		let params: TaskParams;
		try {
			params = (await request.json()) as TaskParams;
		} catch {
			return Response.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const authHeader = request.headers.get("Authorization");
		const userToken = authHeader?.startsWith("Bearer ")
			? authHeader.slice("Bearer ".length).trim()
			: "";
		if (!userToken) {
			return Response.json(
				{ error: "Missing authorization token" },
				{ status: 401 },
			);
		}

		const secrets: TaskSecrets = {
			userToken,
			githubToken: request.headers.get("X-GitHub-Token") || undefined,
		};

		if (
			typeof params.repo !== "string" ||
			typeof params.task !== "string" ||
			typeof params.polychatApiUrl !== "string"
		) {
			return Response.json({ error: "Invalid task payload" }, { status: 400 });
		}

		// TODO: Add code interpreter: https://developers.cloudflare.com/sandbox/guides/code-execution/
		switch (params.taskType) {
			case "feature-implementation":
				return Response.json(
					await executeFeatureImplementation(params, secrets, env),
				);
			default:
				return Response.json({ error: "Unknown task type" }, { status: 400 });
		}
	},
};

export { Sandbox } from "@cloudflare/sandbox";
