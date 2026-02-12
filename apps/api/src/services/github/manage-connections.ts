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
