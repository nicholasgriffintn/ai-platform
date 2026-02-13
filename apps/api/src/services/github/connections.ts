import type { ServiceContext } from "~/lib/context/serviceContext";
import type { AppData } from "~/repositories/AppDataRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	parseGitHubConnectionData,
	recordAllowsRepo,
	type GitHubAppConnection,
	type GitHubConnectionRecordData,
} from "./connection-parser";
import {
	decryptGitHubConnectionPayload,
	type EncryptedGitHubConnectionPayload,
} from "./connection-crypto";
import { safeParseJson } from "~/utils/json";

export const GITHUB_CONNECTION_APP_ID = "github_app_connection";

export interface GitHubAppConnectionSummary {
	installationId: number;
	appId: string;
	repositories: string[];
	hasWebhookSecret: boolean;
	createdAt: string;
	updatedAt: string;
}

async function decodeConnectionRecord(
	context: ServiceContext,
	record: AppData,
): Promise<ReturnType<typeof parseGitHubConnectionData> | null> {
	const parsedRecord = safeParseJson(record.data) as {
		encrypted?: EncryptedGitHubConnectionPayload;
	} | null;

	if (!parsedRecord?.encrypted) {
		return null;
	}
	if (!context.env.JWT_SECRET) {
		throw new AssistantError(
			"JWT secret not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const decryptedData = await decryptGitHubConnectionPayload({
		jwtSecret: context.env.JWT_SECRET,
		userId: record.user_id,
		encrypted: parsedRecord.encrypted,
	});

	return parseGitHubConnectionData({
		data: decryptedData,
		recordItemId: record.item_id,
	});
}

async function decodeConnectionRecordOrThrow(
	context: ServiceContext,
	record: AppData,
): Promise<{
	data: GitHubConnectionRecordData;
	connection: GitHubAppConnection;
}> {
	const parsed = await decodeConnectionRecord(context, record);
	if (!parsed) {
		throw new AssistantError(
			"GitHub App connection is invalid",
			ErrorType.NOT_FOUND,
		);
	}

	return parsed;
}

export async function getGitHubAppConnectionForUserRepo(
	context: ServiceContext,
	userId: number,
	repo: string,
): Promise<GitHubAppConnection> {
	const records = await context.repositories.appData.getAppDataByUserAndApp(
		userId,
		GITHUB_CONNECTION_APP_ID,
	);

	for (const record of records) {
		const parsed = await decodeConnectionRecord(context, record);
		if (!parsed) {
			continue;
		}

		if (!recordAllowsRepo(parsed.data, repo)) {
			continue;
		}

		return parsed.connection;
	}

	throw new AssistantError(
		"GitHub App connection not found for repository",
		ErrorType.NOT_FOUND,
	);
}

export async function getGitHubAppConnectionForUserInstallation(
	context: ServiceContext,
	userId: number,
	installationId: number,
): Promise<GitHubAppConnection> {
	const installationKey = String(installationId);
	const byItemId =
		await context.repositories.appData.getAppDataByUserAppAndItem(
			userId,
			GITHUB_CONNECTION_APP_ID,
			installationKey,
			"github_installation",
		);

	if (!byItemId.length) {
		throw new AssistantError(
			"GitHub App connection not found for installation",
			ErrorType.NOT_FOUND,
		);
	}

	const parsed = await decodeConnectionRecordOrThrow(context, byItemId[0]);
	if (parsed.connection.installationId !== installationId) {
		throw new AssistantError(
			"GitHub App connection is invalid for installation",
			ErrorType.NOT_FOUND,
		);
	}

	return parsed.connection;
}

export async function getGitHubAppConnectionForInstallation(
	context: ServiceContext,
	installationId: number,
): Promise<GitHubAppConnection> {
	const installationKey = String(installationId);
	const byItemId = await context.repositories.appData.getAppDataByAppAndItemId(
		GITHUB_CONNECTION_APP_ID,
		installationKey,
	);

	if (!byItemId) {
		throw new AssistantError(
			"GitHub App connection not found for installation",
			ErrorType.NOT_FOUND,
		);
	}

	const parsed = await decodeConnectionRecordOrThrow(context, byItemId);

	if (parsed.connection.installationId !== installationId) {
		throw new AssistantError(
			"GitHub App connection is invalid for installation",
			ErrorType.NOT_FOUND,
		);
	}

	return parsed.connection;
}

export async function listGitHubAppConnectionsForUser(
	context: ServiceContext,
	userId: number,
): Promise<GitHubAppConnectionSummary[]> {
	const records = await context.repositories.appData.getAppDataByUserAndApp(
		userId,
		GITHUB_CONNECTION_APP_ID,
	);

	const summaries: GitHubAppConnectionSummary[] = [];

	for (const record of records) {
		const parsed = await decodeConnectionRecord(context, record);
		if (!parsed) {
			continue;
		}

		summaries.push({
			installationId: parsed.connection.installationId,
			appId: parsed.connection.appId,
			repositories: parsed.data.repositories ?? [],
			hasWebhookSecret: Boolean(parsed.connection.webhookSecret),
			createdAt: record.created_at,
			updatedAt: record.updated_at,
		});
	}

	return summaries.sort((a, b) => {
		const aTime = new Date(a.updatedAt).getTime();
		const bTime = new Date(b.updatedAt).getTime();
		return bTime - aTime;
	});
}
