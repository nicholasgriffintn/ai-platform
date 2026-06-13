import { addRoute } from "~/lib/http/routeBuilder";
import { type Hono } from "hono";
import z from "zod/v4";

import {
	autoConnectSchema,
	errorResponseSchema,
	githubConnectionSchema,
	sandboxConnectionRepositoriesSchema,
} from "@assistant/schemas";

import {
	canAutoConnectGitHubApp,
	getGitHubAppCallbackUrl,
	getGitHubAppInstallUrl,
} from "~/lib/providers/capabilities/connectors";
import {
	getGitHubAppConnectionForUserInstallation,
	listGitHubAppConnectionsForUser,
	listGitHubInstallationRepositoriesForUser,
} from "~/services/github/connections";
import {
	deleteGitHubConnectionForUser,
	upsertGitHubConnectionFromDefaultAppForUser,
	upsertGitHubConnectionForUser,
} from "~/services/github/manage-connections";
import { AssistantError, ErrorType } from "~/utils/errors";

const installationParamsSchema = z.object({
	installationId: z.string().min(1),
});

function parseInstallationId(value: string): number {
	const installationId = Number.parseInt(value, 10);
	if (!Number.isFinite(installationId) || installationId <= 0) {
		throw new AssistantError("installationId must be a positive integer", ErrorType.PARAMS_ERROR);
	}
	return installationId;
}

export function registerSandboxConnectionRoutes(app: Hono): void {
	addRoute(app, "get", "/connections", {
		tags: ["apps"],
		description: "List user's GitHub App connections",
		auth: true,
		responses: {
			200: { description: "List of GitHub App connections" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ serviceContext, user }) => {
			const connections = await listGitHubAppConnectionsForUser(serviceContext, user.id);
			return { connections };
		},
	});

	addRoute(app, "get", "/github/install-config", {
		tags: ["apps"],
		description: "List the GitHub App installation URL and auto-connect capability",
		auth: true,
		responses: {
			200: {
				description: "GitHub App installation URL and auto-connect capability",
			},
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ serviceContext }) => {
			return {
				installUrl: getGitHubAppInstallUrl(serviceContext.env),
				canAutoConnect: canAutoConnectGitHubApp(serviceContext.env),
				callbackUrl: getGitHubAppCallbackUrl(serviceContext.env),
			};
		},
	});

	addRoute(app, "post", "/connections", {
		tags: ["apps"],
		description: "Add or update a GitHub App connection for the user",
		auth: true,
		bodySchema: githubConnectionSchema,
		responses: {
			200: {
				description: "GitHub App connection added or updated successfully",
			},
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ body, serviceContext, user }) => {
			await upsertGitHubConnectionForUser(serviceContext, user.id, body);

			return {
				success: true,
				message: "GitHub App connection saved successfully",
			};
		},
	});

	addRoute(app, "post", "/connections/auto", {
		tags: ["apps"],
		description: "Connect user's GitHub App installation automatically",
		auth: true,
		bodySchema: autoConnectSchema,
		responses: {
			200: { description: "GitHub App installation connected successfully" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ body, serviceContext, user }) => {
			await upsertGitHubConnectionFromDefaultAppForUser(serviceContext, user.id, {
				installationId: body.installationId,
				repositories: body.repositories,
			});

			return {
				success: true,
				message: "GitHub App installation connected successfully",
			};
		},
	});

	addRoute(app, "get", "/connections/:installationId/repositories", {
		tags: ["apps"],
		description: "List repositories available to a connected GitHub App installation",
		auth: true,
		paramSchema: installationParamsSchema,
		responses: {
			200: { description: "List of repositories available to the installation" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ params, serviceContext, user }) => {
			const installationId = parseInstallationId(params.installationId);
			const repositories = await listGitHubInstallationRepositoriesForUser(
				serviceContext,
				user.id,
				installationId,
			);

			return { repositories };
		},
	});

	addRoute(app, "put", "/connections/:installationId/repositories", {
		tags: ["apps"],
		description: "Replace the configured repositories for a GitHub App connection",
		auth: true,
		bodySchema: sandboxConnectionRepositoriesSchema,
		paramSchema: installationParamsSchema,
		responses: {
			200: { description: "GitHub App connection repositories updated successfully" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ body, params, serviceContext, user }) => {
			const installationId = parseInstallationId(params.installationId);
			const existingConnection = await getGitHubAppConnectionForUserInstallation(
				serviceContext,
				user.id,
				installationId,
			);
			await upsertGitHubConnectionForUser(serviceContext, user.id, {
				installationId,
				appId: existingConnection.appId,
				privateKey: existingConnection.privateKey,
				webhookSecret: existingConnection.webhookSecret,
				repositories: body.repositories,
			});

			return {
				success: true,
				message: "GitHub App connection repositories updated",
			};
		},
	});

	addRoute(app, "delete", "/connections/:installationId", {
		tags: ["apps"],
		description: "Delete a user's GitHub App connection",
		auth: true,
		paramSchema: installationParamsSchema,
		responses: {
			200: { description: "GitHub App connection deleted successfully" },
			401: { description: "Unauthorized", schema: errorResponseSchema },
		},
		handler: async ({ params, serviceContext, user }) => {
			const installationId = parseInstallationId(params.installationId);
			await deleteGitHubConnectionForUser(serviceContext, user.id, installationId);

			return {
				success: true,
				message: "GitHub App connection deleted",
			};
		},
	});
}
