import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, type Hono } from "hono";

import {
	autoConnectSchema,
	errorResponseSchema,
	githubConnectionSchema,
	type AutoConnectPayload,
	type GitHubConnectionPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import type { IUser } from "~/types";
import { listGitHubAppConnectionsForUser } from "~/services/github/connections";
import {
	deleteGitHubConnectionForUser,
	upsertGitHubConnectionFromDefaultAppForUser,
	upsertGitHubConnectionForUser,
} from "~/services/github/manage-connections";
import { AssistantError, ErrorType } from "~/utils/errors";

function getGitHubInstallUrl(context: Context): string | undefined {
	const explicitUrl = context.env.GITHUB_APP_INSTALL_URL?.trim();
	if (explicitUrl) {
		return explicitUrl;
	}

	const appSlug = context.env.GITHUB_APP_SLUG?.trim();
	if (!appSlug) {
		return undefined;
	}

	return `https://github.com/apps/${appSlug}/installations/new`;
}

export function registerSandboxConnectionRoutes(app: Hono): void {
	addRoute(app, "get", "/connections", {
		tags: ["apps"],
		description: "List user's GitHub App connections",
		responses: {
			200: { description: "List of GitHub App connections" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = c.get("user") as IUser;
				const serviceContext = getServiceContext(c);
				const connections = await listGitHubAppConnectionsForUser(
					serviceContext,
					user.id,
				);
				return ResponseFactory.success(c, { connections });
			})(raw),
	});

	addRoute(app, "get", "/github/install-config", {
		tags: ["apps"],
		description:
			"List the GitHub App installation URL and auto-connect capability",
		responses: {
			200: {
				description: "GitHub App installation URL and auto-connect capability",
			},
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
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
			})(raw),
	});

	addRoute(app, "post", "/connections", {
		tags: ["apps"],
		description: "Add or update a GitHub App connection for the user",
		bodySchema: githubConnectionSchema,
		responses: {
			200: {
				description: "GitHub App connection added or updated successfully",
			},
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = c.get("user") as IUser;
				const payload = c.req.valid("json" as never) as GitHubConnectionPayload;
				const serviceContext = getServiceContext(c);

				await upsertGitHubConnectionForUser(serviceContext, user.id, payload);

				return ResponseFactory.success(c, {
					success: true,
					message: "GitHub App connection saved successfully",
				});
			})(raw),
	});

	addRoute(app, "post", "/connections/auto", {
		tags: ["apps"],
		description: "Connect user's GitHub App installation automatically",
		bodySchema: autoConnectSchema,
		responses: {
			200: { description: "GitHub App installation connected successfully" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
				const user = c.get("user") as IUser;
				const payload = c.req.valid("json" as never) as AutoConnectPayload;
				const serviceContext = getServiceContext(c);

				await upsertGitHubConnectionFromDefaultAppForUser(
					serviceContext,
					user.id,
					{
						installationId: payload.installationId,
						repositories: payload.repositories,
					},
				);

				return ResponseFactory.success(c, {
					success: true,
					message: "GitHub App installation connected successfully",
				});
			})(raw),
	});

	addRoute(app, "delete", "/connections/:installationId", {
		tags: ["apps"],
		description: "Delete a user's GitHub App connection",
		responses: {
			200: { description: "GitHub App connection deleted successfully" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ raw }) =>
			(async (c: Context) => {
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
			})(raw),
	});
}
