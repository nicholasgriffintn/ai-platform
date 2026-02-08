import { executeFeatureImplementation } from "./tasks/feature-implementation";
import type { TaskParams, Env } from "./types";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/execute" && request.method === "POST") {
			const params = (await request.json()) as TaskParams;

			// TODO: Add code interpreter: https://developers.cloudflare.com/sandbox/guides/code-execution/

			let result;
			switch (params.taskType) {
				case "feature-implementation":
					result = await executeFeatureImplementation(params, env);
					break;
				default:
					return Response.json({ error: "Unknown task type" }, { status: 400 });
			}

			return Response.json(result);
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	},
};

export { Sandbox } from "@cloudflare/sandbox";
