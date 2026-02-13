import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { GITHUB_CONNECTION_APP_ID } from "./connections";
import { encryptGitHubConnectionPayload } from "./connection-crypto";

export interface UpsertGitHubConnectionInput {
	installationId: number;
	appId: string;
	privateKey: string;
	webhookSecret?: string;
	repositories?: string[];
}

interface DefaultGitHubAppCredentials {
	appId: string;
	privateKey: string;
	webhookSecret?: string;
}

function normaliseRepositories(repositories?: string[]): string[] | undefined {
	if (!repositories) {
		return undefined;
	}

	const normalized = repositories
		.map((repo) => repo.trim().toLowerCase())
		.filter(Boolean);

	if (normalized.length === 0) {
		return undefined;
	}

	return Array.from(new Set(normalized));
}

function resolveDefaultGitHubAppCredentials(
	context: ServiceContext,
): DefaultGitHubAppCredentials {
	const appId = context.env.GITHUB_APP_ID?.trim();
	const privateKeyRaw = context.env.GITHUB_APP_PRIVATE_KEY?.trim();
	const webhookSecret = context.env.GITHUB_APP_WEBHOOK_SECRET?.trim();

	if (!appId || !privateKeyRaw) {
		throw new AssistantError(
			"Default GitHub App is not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return {
		appId,
		privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
		webhookSecret: webhookSecret || undefined,
	};
}

export async function upsertGitHubConnectionForUser(
	context: ServiceContext,
	userId: number,
	input: UpsertGitHubConnectionInput,
): Promise<{ installationId: number }> {
	if (!context.env.JWT_SECRET) {
		throw new AssistantError(
			"JWT secret not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const encrypted = await encryptGitHubConnectionPayload({
		jwtSecret: context.env.JWT_SECRET,
		userId,
		payload: {
			app_id: input.appId.trim(),
			private_key: input.privateKey.trim(),
			installation_id: input.installationId,
			webhook_secret: input.webhookSecret?.trim() || undefined,
			repositories: normaliseRepositories(input.repositories),
		},
	});

	const itemId = String(input.installationId);
	const existing =
		await context.repositories.appData.getAppDataByUserAppAndItem(
			userId,
			GITHUB_CONNECTION_APP_ID,
			itemId,
			"github_installation",
		);

	const data = {
		encrypted,
	};

	if (existing.length > 0) {
		await context.repositories.appData.updateAppData(existing[0].id, data);
	} else {
		await context.repositories.appData.createAppDataWithItem(
			userId,
			GITHUB_CONNECTION_APP_ID,
			itemId,
			"github_installation",
			data,
		);
	}

	return { installationId: input.installationId };
}

export async function upsertGitHubConnectionFromDefaultAppForUser(
	context: ServiceContext,
	userId: number,
	input: {
		installationId: number;
		repositories?: string[];
	},
): Promise<{ installationId: number }> {
	const credentials = resolveDefaultGitHubAppCredentials(context);

	return upsertGitHubConnectionForUser(context, userId, {
		installationId: input.installationId,
		appId: credentials.appId,
		privateKey: credentials.privateKey,
		webhookSecret: credentials.webhookSecret,
		repositories: input.repositories,
	});
}

export async function deleteGitHubConnectionForUser(
	context: ServiceContext,
	userId: number,
	installationId: number,
): Promise<void> {
	const itemId = String(installationId);
	await context.repositories.appData.deleteAppDataByUserAppAndItem(
		userId,
		GITHUB_CONNECTION_APP_ID,
		itemId,
		"github_installation",
	);
}
