import { WorkerEntrypoint } from "cloudflare:workers";
import type { DynamicWorkerTailEvent, Env } from "./types";
import { createJsonResponse, getBearerToken } from "./lib/http";
import { verifySandboxJwt } from "./lib/auth";
import { handleDynamicExecute } from "./handlers/execute-dynamic";
import { handleSandboxExecute } from "./handlers/execute-sandbox";

export class ToolGateway extends WorkerEntrypoint<
	Env,
	{ capabilities?: string[]; userToken: string; runId: string }
> {
	private hasCapability(name: string): boolean {
		const capabilities = this.ctx.props.capabilities;
		return Array.isArray(capabilities) && capabilities.includes(name);
	}

	async echo(value: string): Promise<string> {
		if (!this.hasCapability("echo")) {
			throw new Error("Capability 'echo' is not allowed");
		}
		return value;
	}

	async now(): Promise<string> {
		if (!this.hasCapability("clock")) {
			throw new Error("Capability 'clock' is not allowed");
		}
		return new Date().toISOString();
	}

	async polychatFetch(path: string): Promise<{ status: number; body: string }> {
		if (!this.hasCapability("polychat_fetch")) {
			throw new Error("Capability 'polychat_fetch' is not allowed");
		}

		const trimmedPath = path.startsWith("/") ? path : `/${path}`;
		const response = await this.env.POLYCHAT_API.fetch(
			new Request(`http://polychat-api${trimmedPath}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${this.ctx.props.userToken}`,
					Accept: "application/json",
				},
			}),
		);
		const body = (await response.text()).slice(0, 4000);
		return {
			status: response.status,
			body,
		};
	}
}

export class DynamicWorkerTail extends WorkerEntrypoint<
	Env,
	{ runId: string }
> {
	async tail(events: DynamicWorkerTailEvent[]): Promise<void> {
		for (const event of events) {
			for (const log of event.logs) {
				console.log(
					JSON.stringify({
						source: "dynamic-worker-tail",
						runId: this.ctx.props.runId,
						level: log.level,
						message: log.message,
					}),
				);
			}
		}
	}
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);
		if (request.method !== "POST") {
			return createJsonResponse(405, { error: "Method not allowed" });
		}

		if (url.pathname !== "/execute-dynamic" && url.pathname !== "/execute") {
			return createJsonResponse(404, { error: "Not found" });
		}

		if (!env.JWT_SECRET?.trim()) {
			return createJsonResponse(503, {
				error: "Dynamic runtime authentication secret is not configured",
			});
		}

		if (!env.LOADER) {
			return createJsonResponse(503, {
				error: "Worker loader binding is not configured",
			});
		}

		if (!env.POLYCHAT_API) {
			return createJsonResponse(503, {
				error: "Polychat API service binding is not configured",
			});
		}

		const userToken = getBearerToken(request);
		if (!userToken) {
			return createJsonResponse(401, { error: "Missing authorization token" });
		}

		let verifiedUserId = 0;
		try {
			const verified = await verifySandboxJwt(userToken, env.JWT_SECRET.trim());
			verifiedUserId = verified.userId;
		} catch {
			return createJsonResponse(401, {
				error: "Invalid dynamic runtime authorization token",
			});
		}

		if (url.pathname === "/execute-dynamic") {
			return handleDynamicExecute({
				request,
				env,
				ctx,
				userToken,
				verifiedUserId,
			});
		}

		return handleSandboxExecute({
			request,
			env,
			ctx,
			userToken,
			verifiedUserId,
		});
	},
};
