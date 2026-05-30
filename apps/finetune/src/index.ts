import { finetuneWorkerDeployModelSchema, finetuneWorkerStartJobSchema } from "@assistant/schemas";

import { TrainingWorkerService } from "./services/TrainingWorkerService.js";
import type { Env } from "./types/env.js";
import { errorResponse, HttpError, jsonResponse, parseJsonBody } from "./utils/http.js";
import { decodeRouteSegment, decodeTrainingProvider } from "./utils/trainingRoutes.js";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			return await route(request, env);
		} catch (error) {
			return errorResponse(error);
		}
	},
};

async function route(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const service = new TrainingWorkerService(env);

	if (request.method === "GET" && url.pathname === "/status") {
		return jsonResponse({ ok: true });
	}

	if (request.method === "POST" && url.pathname === "/jobs") {
		const body = await parseJsonBody(request, finetuneWorkerStartJobSchema);
		return jsonResponse(await service.startJob(body));
	}

	const jobEventsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/([^/]+)\/events$/);
	if (request.method === "GET" && jobEventsMatch) {
		const provider = decodeTrainingProvider(jobEventsMatch[1]);
		const jobName = decodeRouteSegment(jobEventsMatch[2]);
		const limit = Number(url.searchParams.get("limit") || 100);
		const events = await service.listEvents(provider, jobName);
		return jsonResponse({ events: events.slice(0, Math.min(Math.max(limit, 1), 500)) });
	}

	const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/([^/]+)$/);
	if (request.method === "GET" && jobMatch) {
		return jsonResponse(
			await service.getJob(decodeTrainingProvider(jobMatch[1]), decodeRouteSegment(jobMatch[2])),
		);
	}

	if (request.method === "POST" && url.pathname === "/deployments") {
		const body = await parseJsonBody(request, finetuneWorkerDeployModelSchema);
		return jsonResponse(await service.deployModel(body));
	}

	const deploymentMatch = url.pathname.match(/^\/deployments\/([^/]+)\/([^/]+)$/);
	if (request.method === "GET" && deploymentMatch) {
		return jsonResponse(
			await service.getDeployment(
				decodeTrainingProvider(deploymentMatch[1]),
				decodeRouteSegment(deploymentMatch[2]),
			),
		);
	}

	throw new HttpError("Not found", 404);
}
