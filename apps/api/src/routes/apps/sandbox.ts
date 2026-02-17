import { type Context, Hono } from "hono";
import { validator as zValidator, describeRoute, resolver } from "hono-openapi";
import {
	autoConnectSchema,
	cancelRunSchema,
	pauseRunSchema,
	resumeRunSchema,
	errorResponseSchema,
	executeSandboxRunSchema,
	githubConnectionSchema,
	listRunsQuerySchema,
	type AutoConnectPayload,
	type CancelRunPayload,
	type ExecuteSandboxRunPayload,
	type GitHubConnectionPayload,
	type ListRunsQueryPayload,
	type PauseRunPayload,
	type ResumeRunPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { requirePlan } from "~/middleware/requirePlan";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import type { IUser } from "~/types";
import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import {
	getSandboxRunForUser,
	getSandboxRunControlState,
	listSandboxRunsForUser,
	requestSandboxRunCancellation,
	requestSandboxRunPause,
	requestSandboxRunResume,
} from "~/services/apps/sandbox/runs";
import { listGitHubAppConnectionsForUser } from "~/services/github/connections";
import {
	deleteGitHubConnectionForUser,
	upsertGitHubConnectionFromDefaultAppForUser,
	upsertGitHubConnectionForUser,
} from "~/services/github/manage-connections";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();
const routeLogger = createRouteLogger("apps/sandbox");

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
		const payload = c.req.valid("json" as never) as GitHubConnectionPayload;
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
		const payload = c.req.valid("json" as never) as AutoConnectPayload;
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
		const payload = c.req.valid("query" as never) as ListRunsQueryPayload;
		const serviceContext = getServiceContext(c);

		const runs = await listSandboxRunsForUser({
			context: serviceContext,
			userId: user.id,
			installationId: payload.installationId,
			repo: payload.repo,
			limit: payload.limit,
		});

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

		const run = await getSandboxRunForUser({
			context: getServiceContext(c),
			userId: user.id,
			runId,
		});

		return ResponseFactory.success(c, { run });
	},
);

app.post(
	"/runs/:runId/pause",
	describeRoute({
		tags: ["apps"],
		description: "Pause a running sandbox run",
		responses: {
			200: {
				description: "Sandbox run pause was processed",
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
	zValidator("json", pauseRunSchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const runId = c.req.param("runId");
		const payload = c.req.valid("json" as never) as PauseRunPayload;
		if (!runId) {
			throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
		}

		const result = await requestSandboxRunPause({
			context: getServiceContext(c),
			userId: user.id,
			runId,
			reason: payload.reason,
		});

		return ResponseFactory.success(c, result);
	},
);

app.post(
	"/runs/:runId/resume",
	describeRoute({
		tags: ["apps"],
		description: "Resume a paused sandbox run",
		responses: {
			200: {
				description: "Sandbox run resume was processed",
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
	zValidator("json", resumeRunSchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const runId = c.req.param("runId");
		const payload = c.req.valid("json" as never) as ResumeRunPayload;
		if (!runId) {
			throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
		}

		const result = await requestSandboxRunResume({
			context: getServiceContext(c),
			userId: user.id,
			runId,
			reason: payload.reason,
		});

		return ResponseFactory.success(c, result);
	},
);

app.post(
	"/runs/:runId/cancel",
	describeRoute({
		tags: ["apps"],
		description: "Cancel a running sandbox run",
		responses: {
			200: {
				description: "Sandbox run cancellation was processed",
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
	zValidator("json", cancelRunSchema),
	async (c: Context) => {
		const user = c.get("user") as IUser;
		const runId = c.req.param("runId");
		const payload = c.req.valid("json" as never) as CancelRunPayload;
		if (!runId) {
			throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
		}

		const result = await requestSandboxRunCancellation({
			context: getServiceContext(c),
			userId: user.id,
			runId,
			reason: payload.reason,
		});

		return ResponseFactory.success(c, result);
	},
);

app.get(
	"/runs/:runId/control",
	describeRoute({
		tags: ["apps"],
		description: "Get run execution control state for worker coordination",
		responses: {
			200: {
				description: "Sandbox run control state",
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

		const control = await getSandboxRunControlState({
			context: getServiceContext(c),
			userId: user.id,
			runId,
		});

		return ResponseFactory.success(c, control);
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
		const payload = c.req.valid("json" as never) as ExecuteSandboxRunPayload;

		return executeSandboxRunStream({
			env: c.env,
			context: serviceContext,
			user,
			payload,
		});
	},
);

export default app;
