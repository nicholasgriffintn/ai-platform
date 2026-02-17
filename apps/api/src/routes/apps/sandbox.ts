import { type Context, Hono } from "hono";
import { validator as zValidator, describeRoute, resolver } from "hono-openapi";
import z from "zod/v4";
import {
	listArticlesResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { requirePlan } from "~/middleware/requirePlan";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import type { IUser } from "~/types";
import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import { listGitHubAppConnectionsForUser } from "~/services/github/connections";
import {
	deleteGitHubConnectionForUser,
	upsertGitHubConnectionFromDefaultAppForUser,
	upsertGitHubConnectionForUser,
} from "~/services/github/manage-connections";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { SANDBOX_RUNS_APP_ID, SANDBOX_RUN_ITEM_TYPE } from "~/constants/app";

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

app.get(
	"/connections",
	describeRoute({
		tags: ["apps"],
		description: "List user's GitHub App connections",
		responses: {
			200: {
				description: "List of GitHub App connections",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const serviceContext = getServiceContext(c);

		const connections = await listGitHubAppConnectionsForUser(
			serviceContext,
			user.id,
		);

		return ResponseFactory.success(c, { connections });
	},
);

app.get(
	"/github/install-config",
	describeRoute({
		tags: ["apps"],
		description:
			"List the GitHub App installation URL and auto-connect capability",
		responses: {
			200: {
				description: "GitHub App installation URL and auto-connect capability",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (c: Context) => {
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
	},
);

app.post(
	"/connections",
	describeRoute({
		tags: ["apps"],
		description: "Add or update a GitHub App connection for the user",
		responses: {
			200: {
				description: "GitHub App connection added or updated successfully",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
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
	describeRoute({
		tags: ["apps"],
		description: "Connect user's GitHub App installation automatically",
		responses: {
			200: {
				description: "GitHub App installation connected successfully",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
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

app.delete(
	"/connections/:installationId",
	describeRoute({
		tags: ["apps"],
		description: "Delete a user's GitHub App connection",
		responses: {
			200: {
				description: "GitHub App connection deleted successfully",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (c: Context) => {
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
		await deleteGitHubConnectionForUser(
			serviceContext,
			user.id,
			installationId,
		);

		return ResponseFactory.success(c, {
			success: true,
			message: "GitHub App connection deleted",
		});
	},
);

app.get(
	"/runs",
	describeRoute({
		tags: ["apps"],
		description:
			"List user's GitHub App runs with optional filtering by installation and repo",
		responses: {
			200: {
				description: "List of GitHub App runs",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
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

app.get(
	"/runs/:runId",
	describeRoute({
		tags: ["apps"],
		description: "Get details of a specific GitHub App run",
		responses: {
			200: {
				description: "Details of a specific GitHub App run",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	async (c: Context) => {
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
	},
);

app.post(
	"/runs/execute-stream",
	describeRoute({
		tags: ["apps"],
		description: "Execute a Sandbox run with streaming output",
		responses: {
			200: {
				description: "Sandbox run executed successfully",
				content: {
					"application/json": {},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", executeSandboxRunSchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const serviceContext = getServiceContext(c);
		const payload = c.req.valid("json" as never) as z.infer<
			typeof executeSandboxRunSchema
		>;

		return executeSandboxRunStream({
			env: c.env,
			context: serviceContext,
			user,
			payload,
		});
	},
);

export default app;
