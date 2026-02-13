import { type Context, Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import z from "zod/v4";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { requirePlan } from "~/middleware/requirePlan";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { generateId } from "~/utils/id";
import type { IUser } from "~/types";
import { listGitHubAppConnectionsForUser } from "~/services/github/connections";
import {
	deleteGitHubConnectionForUser,
	upsertGitHubConnectionFromDefaultAppForUser,
	upsertGitHubConnectionForUser,
} from "~/services/github/manage-connections";
import {
	executeSandboxWorker,
	resolveSandboxModel,
} from "~/services/sandbox/worker";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { parseSseBuffer } from "~/utils/streaming";
import {
	SANDBOX_RUNS_APP_ID,
	SANDBOX_RUN_ITEM_TYPE,
	MAX_STORED_STREAM_EVENTS,
} from "~/constants/app";

const app = new Hono();
const routeLogger = createRouteLogger("apps/sandbox");

const githubConnectionSchema = z.object({
	installationId: z.number().int().positive(),
	appId: z.string().trim().min(1),
	privateKey: z.string().trim().min(1),
	webhookSecret: z.string().trim().min(1).optional(),
	repositories: z.array(z.string().trim().min(1)).optional(),
});

const executeSandboxRunSchema = z.object({
	installationId: z.number().int().positive(),
	repo: z
		.string()
		.trim()
		.min(1)
		.regex(/^[\w.-]+\/[\w.-]+$/, "repo must be in owner/repo format"),
	task: z.string().trim().min(1),
	model: z.string().trim().min(1).optional(),
	shouldCommit: z.boolean().optional(),
});

const autoConnectSchema = z.object({
	installationId: z.number().int().positive(),
	repositories: z.array(z.string().trim().min(1)).optional(),
});

const listRunsQuerySchema = z.object({
	installationId: z.coerce.number().int().positive().optional(),
	repo: z.string().trim().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(30),
});

type SandboxRunStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

interface SandboxRunData {
	runId: string;
	installationId: number;
	repo: string;
	task: string;
	model: string;
	shouldCommit: boolean;
	status: SandboxRunStatus;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	error?: string;
	events?: Array<Record<string, unknown>>;
	result?: Record<string, unknown>;
}

async function persistFailedRun(params: {
	serviceContext: ReturnType<typeof getServiceContext>;
	recordId: string;
	initialRunData: SandboxRunData;
	error: unknown;
}): Promise<void> {
	const { serviceContext, recordId, initialRunData, error } = params;
	const errorMessage =
		error instanceof Error ? error.message : "Sandbox execution failed";
	const completedAt = new Date().toISOString();

	await serviceContext.repositories.appData.updateAppData(recordId, {
		...initialRunData,
		status: "failed",
		error: errorMessage.slice(0, 1000),
		updatedAt: completedAt,
		completedAt,
	});
}

app.use("/*", (c, next) => {
	routeLogger.info(`Processing apps/sandbox route: ${c.req.path}`);
	return next();
});

app.use("/*", requirePlan("pro"));

const getGitHubInstallUrl = (context: Context): string | undefined => {
	const explicitUrl = context.env.GITHUB_APP_INSTALL_URL?.trim();
	if (explicitUrl) {
		return explicitUrl;
	}

	const appSlug = context.env.GITHUB_APP_SLUG?.trim();
	if (!appSlug) {
		return undefined;
	}

	return `https://github.com/apps/${appSlug}/installations/new`;
};

const toRunResponse = (data: SandboxRunData) => ({
	runId: data.runId,
	installationId: data.installationId,
	repo: data.repo,
	task: data.task,
	model: data.model,
	shouldCommit: data.shouldCommit,
	status: data.status,
	startedAt: data.startedAt,
	updatedAt: data.updatedAt,
	completedAt: data.completedAt,
	error: data.error,
	result: data.result,
	events: data.events ?? [],
});

const parseSandboxRunData = (value: unknown): SandboxRunData | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const raw = value as Record<string, unknown>;
	if (
		typeof raw.runId !== "string" ||
		typeof raw.installationId !== "number" ||
		typeof raw.repo !== "string" ||
		typeof raw.task !== "string" ||
		typeof raw.model !== "string" ||
		typeof raw.shouldCommit !== "boolean" ||
		typeof raw.status !== "string" ||
		typeof raw.startedAt !== "string" ||
		typeof raw.updatedAt !== "string"
	) {
		return null;
	}

	return raw as unknown as SandboxRunData;
};

app.get("/connections", async (c: Context) => {
	const user = c.get("user") as IUser;
	const serviceContext = getServiceContext(c);

	const connections = await listGitHubAppConnectionsForUser(
		serviceContext,
		user.id,
	);

	return ResponseFactory.success(c, { connections });
});

app.get("/github/install-config", async (c: Context) => {
	const canAutoConnect = Boolean(
		c.env.GITHUB_APP_ID?.trim() && c.env.GITHUB_APP_PRIVATE_KEY?.trim(),
	);
	const callbackUrl = c.env.APP_BASE_URL
		? `${c.env.APP_BASE_URL.replace(/\/$/, "")}/apps/sandbox`
		: undefined;

	return ResponseFactory.success(c, {
		installUrl: getGitHubInstallUrl(c),
		canAutoConnect,
		callbackUrl,
	});
});

app.post(
	"/connections",
	zValidator("json", githubConnectionSchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const payload = c.req.valid("json" as never) as z.infer<
			typeof githubConnectionSchema
		>;
		const serviceContext = getServiceContext(c);

		await upsertGitHubConnectionForUser(serviceContext, user.id, payload);

		return ResponseFactory.success(c, {
			success: true,
			message: "GitHub App connection saved successfully",
		});
	},
);

app.post(
	"/connections/auto",
	zValidator("json", autoConnectSchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const payload = c.req.valid("json" as never) as z.infer<
			typeof autoConnectSchema
		>;
		const serviceContext = getServiceContext(c);

		await upsertGitHubConnectionFromDefaultAppForUser(serviceContext, user.id, {
			installationId: payload.installationId,
			repositories: payload.repositories,
		});

		return ResponseFactory.success(c, {
			success: true,
			message: "GitHub App installation connected successfully",
		});
	},
);

app.delete("/connections/:installationId", async (c: Context) => {
	const user = c.get("user") as IUser;
	const installationIdRaw = c.req.param("installationId");
	const installationId = Number.parseInt(installationIdRaw || "", 10);

	if (!Number.isFinite(installationId) || installationId <= 0) {
		throw new AssistantError(
			"installationId must be a positive integer",
			ErrorType.PARAMS_ERROR,
		);
	}

	const serviceContext = getServiceContext(c);
	await deleteGitHubConnectionForUser(serviceContext, user.id, installationId);

	return ResponseFactory.success(c, {
		success: true,
		message: "GitHub App connection deleted",
	});
});

app.get(
	"/runs",
	zValidator("query", listRunsQuerySchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const { installationId, repo, limit } = c.req.valid(
			"query" as never,
		) as z.infer<typeof listRunsQuerySchema>;
		const serviceContext = getServiceContext(c);
		const records =
			await serviceContext.repositories.appData.getAppDataByUserAndApp(
				user.id,
				SANDBOX_RUNS_APP_ID,
			);

		const runs = records
			.map((record) => {
				const parsed = parseSandboxRunData(safeParseJson(record.data));
				if (!parsed) {
					return null;
				}

				if (
					installationId !== undefined &&
					parsed.installationId !== installationId
				) {
					return null;
				}

				if (repo && parsed.repo.toLowerCase() !== repo.toLowerCase()) {
					return null;
				}

				return toRunResponse(parsed);
			})
			.filter((run): run is ReturnType<typeof toRunResponse> => Boolean(run))
			.sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			)
			.slice(0, limit);

		return ResponseFactory.success(c, { runs });
	},
);

app.get("/runs/:runId", async (c: Context) => {
	const user = c.get("user") as IUser;
	const runId = c.req.param("runId");

	if (!runId) {
		throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = getServiceContext(c);
	const records =
		await serviceContext.repositories.appData.getAppDataByUserAppAndItem(
			user.id,
			SANDBOX_RUNS_APP_ID,
			runId,
			SANDBOX_RUN_ITEM_TYPE,
		);

	if (!records.length) {
		throw new AssistantError("Sandbox run not found", ErrorType.NOT_FOUND);
	}

	const run = parseSandboxRunData(safeParseJson(records[0].data));
	if (!run) {
		throw new AssistantError(
			"Sandbox run payload is invalid",
			ErrorType.NOT_FOUND,
		);
	}

	return ResponseFactory.success(c, { run: toRunResponse(run) });
});

app.post(
	"/runs/execute-stream",
	zValidator("json", executeSandboxRunSchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const serviceContext = getServiceContext(c);
		const payload = c.req.valid("json" as never) as z.infer<
			typeof executeSandboxRunSchema
		>;

		const model = await resolveSandboxModel({
			context: serviceContext,
			userId: user.id,
			model: payload.model,
		});

		const runId = generateId();
		const now = new Date().toISOString();
		const initialRunData: SandboxRunData = {
			runId,
			installationId: payload.installationId,
			repo: payload.repo,
			task: payload.task,
			model,
			shouldCommit: Boolean(payload.shouldCommit),
			status: "queued",
			startedAt: now,
			updatedAt: now,
			events: [],
		};

		const createdRecord =
			await serviceContext.repositories.appData.createAppDataWithItem(
				user.id,
				SANDBOX_RUNS_APP_ID,
				runId,
				SANDBOX_RUN_ITEM_TYPE,
				initialRunData,
			);

		const runningAt = new Date().toISOString();
		await serviceContext.repositories.appData.updateAppData(createdRecord.id, {
			...initialRunData,
			status: "running",
			updatedAt: runningAt,
		});

		let workerResponse: Response;
		try {
			workerResponse = await executeSandboxWorker({
				env: c.env,
				context: serviceContext,
				user,
				repo: payload.repo,
				task: payload.task,
				model,
				shouldCommit: payload.shouldCommit,
				installationId: payload.installationId,
				stream: true,
				runId,
			});
		} catch (error) {
			await persistFailedRun({
				serviceContext,
				recordId: createdRecord.id,
				initialRunData,
				error,
			});

			const errorMessage =
				error instanceof Error ? error.message : "Failed to start sandbox run";
			routeLogger.error("Failed to start sandbox worker run", {
				run_id: runId,
				installation_id: payload.installationId,
				error_message: errorMessage,
			});
			return c.json({ error: errorMessage }, 500);
		}

		if (!workerResponse.ok) {
			const errorText = await workerResponse.text();
			await serviceContext.repositories.appData.updateAppData(
				createdRecord.id,
				{
					...initialRunData,
					status: "failed",
					error: errorText.slice(0, 1000),
					updatedAt: new Date().toISOString(),
					completedAt: new Date().toISOString(),
				},
			);

			return c.json(
				{
					error: `Sandbox worker error (${workerResponse.status}): ${errorText.slice(0, 500)}`,
				},
				500,
			);
		}

		if (!workerResponse.body) {
			await serviceContext.repositories.appData.updateAppData(
				createdRecord.id,
				{
					...initialRunData,
					status: "failed",
					error: "Sandbox worker returned an empty response body",
					updatedAt: new Date().toISOString(),
					completedAt: new Date().toISOString(),
				},
			);
			return c.json(
				{ error: "Sandbox worker returned an empty response" },
				500,
			);
		}

		const contentType = workerResponse.headers.get("content-type") || "";
		if (!contentType.includes("text/event-stream")) {
			let responseData: Record<string, unknown> | null = null;
			try {
				responseData = (await workerResponse.json()) as Record<string, unknown>;
			} catch {
				await persistFailedRun({
					serviceContext,
					recordId: createdRecord.id,
					initialRunData,
					error: new Error(
						"Sandbox worker returned invalid non-stream response",
					),
				});
				return c.json(
					{ error: "Sandbox worker returned invalid non-stream response" },
					500,
				);
			}

			const status = responseData?.success ? "completed" : "failed";
			await serviceContext.repositories.appData.updateAppData(
				createdRecord.id,
				{
					...initialRunData,
					status,
					result: responseData,
					error:
						typeof responseData?.error === "string"
							? responseData.error
							: undefined,
					updatedAt: new Date().toISOString(),
					completedAt: new Date().toISOString(),
				},
			);

			return ResponseFactory.success(c, {
				run: toRunResponse({
					...initialRunData,
					status,
					result: responseData,
					error:
						typeof responseData?.error === "string"
							? responseData.error
							: undefined,
					updatedAt: new Date().toISOString(),
					completedAt: new Date().toISOString(),
				}),
			});
		}

		const decoder = new TextDecoder();
		const encoder = new TextEncoder();
		const reader = workerResponse.body.getReader();

		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				let status: SandboxRunStatus = "running";
				let buffer = "";
				const events: Array<Record<string, unknown>> = [];
				let result: Record<string, unknown> | undefined;
				let errorMessage: string | undefined;
				let completedAt: string | undefined;

				const pushEvent = (event: Record<string, unknown>) => {
					events.push(event);
					if (events.length > MAX_STORED_STREAM_EVENTS) {
						events.shift();
					}
				};

				const emit = (event: Record<string, unknown>) => {
					pushEvent(event);
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
					);
				};

				const handleParsedEvent = (parsed: Record<string, unknown>) => {
					pushEvent(parsed);

					if (parsed.type === "run_completed") {
						status = "completed";
						completedAt = new Date().toISOString();
						result =
							parsed.result &&
							typeof parsed.result === "object" &&
							!Array.isArray(parsed.result)
								? (parsed.result as Record<string, unknown>)
								: undefined;
					} else if (parsed.type === "run_failed") {
						status = "failed";
						completedAt = new Date().toISOString();
						errorMessage =
							typeof parsed.error === "string"
								? parsed.error
								: "Sandbox run failed";
					} else if (parsed.type === "run_started") {
						status = "running";
					}
				};

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							break;
						}
						if (!value) {
							continue;
						}

						controller.enqueue(value);
						buffer += decoder.decode(value, { stream: true });
						buffer = parseSseBuffer(buffer, {
							onEvent: handleParsedEvent,
							onError: (error) => {
								routeLogger.error("Failed to parse sandbox stream event", {
									error_message: error.message,
								});
							},
						});
					}

					if (buffer.trim()) {
						parseSseBuffer(buffer + "\n\n", {
							onEvent: handleParsedEvent,
							onError: () => {
								// Ignore errors from final buffer flush
							},
						});
					}
				} catch (error) {
					status = "failed";
					completedAt = new Date().toISOString();
					errorMessage =
						error instanceof Error
							? error.message
							: "Sandbox stream unexpectedly terminated";

					emit({
						type: "run_failed",
						runId,
						error: errorMessage,
					});
				} finally {
					reader.releaseLock();

					if (status === "running") {
						status = "failed";
						completedAt = new Date().toISOString();
						errorMessage = "Sandbox stream ended without a final status";
						emit({
							type: "run_failed",
							runId,
							error: errorMessage,
						});
					}

					await serviceContext.repositories.appData.updateAppData(
						createdRecord.id,
						{
							...initialRunData,
							status,
							result,
							error: errorMessage,
							events,
							updatedAt: new Date().toISOString(),
							completedAt,
						},
					);

					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Sandbox-Run-Id": runId,
			},
		});
	},
);

export default app;
