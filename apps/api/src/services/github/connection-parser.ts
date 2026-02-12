export interface GitHubAppConnection {
	appId: string;
	privateKey: string;
	installationId: number;
	webhookSecret?: string;
}

export interface GitHubConnectionRecordData {
	app_id: string;
	private_key: string;
	installation_id: number;
	webhook_secret?: string;
	repositories?: string[];
}

export function parseGitHubConnectionData(params: {
	data: unknown;
	recordItemId?: string;
}): {
	data: GitHubConnectionRecordData;
	connection: GitHubAppConnection;
} | null {
	const { data: rawData, recordItemId } = params;
	if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
		return null;
	}

	const root = rawData as Record<string, unknown>;

	if (typeof root.app_id !== "string" || !root.app_id.trim()) {
		return null;
	}
	if (typeof root.private_key !== "string" || !root.private_key.trim()) {
		return null;
	}
	if (
		typeof root.installation_id !== "number" ||
		!Number.isFinite(root.installation_id)
	) {
		return null;
	}
	if (
		root.webhook_secret !== undefined &&
		typeof root.webhook_secret !== "string"
	) {
		return null;
	}
	if (root.repositories !== undefined && !Array.isArray(root.repositories)) {
		return null;
	}

	const normalizedAppId = root.app_id.trim();
	const normalizedPrivateKey = root.private_key.trim();
	const normalizedWebhookSecret =
		typeof root.webhook_secret === "string" && root.webhook_secret.trim()
			? root.webhook_secret.trim()
			: undefined;
	const normalizedRepositories =
		Array.isArray(root.repositories) && root.repositories.length > 0
			? root.repositories
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim().toLowerCase())
					.filter(Boolean)
			: undefined;

	const installationId = root.installation_id;
	if (recordItemId) {
		const itemInstallationId = Number.parseInt(recordItemId, 10);
		if (
			Number.isFinite(itemInstallationId) &&
			itemInstallationId !== installationId
		) {
			return null;
		}
	}

	const recordData: GitHubConnectionRecordData = {
		app_id: normalizedAppId,
		private_key: normalizedPrivateKey,
		installation_id: installationId,
		webhook_secret: normalizedWebhookSecret,
		repositories: normalizedRepositories,
	};

	return {
		data: recordData,
		connection: {
			appId: recordData.app_id,
			privateKey: recordData.private_key.replace(/\\n/g, "\n"),
			installationId,
			webhookSecret: recordData.webhook_secret,
		},
	};
}

export function recordAllowsRepo(
	data: GitHubConnectionRecordData,
	repo: string,
): boolean {
	const targetRepo = repo.trim().toLowerCase();
	if (!targetRepo) {
		return false;
	}

	if (!data.repositories || data.repositories.length === 0) {
		return true;
	}

	return data.repositories.includes(targetRepo);
}
