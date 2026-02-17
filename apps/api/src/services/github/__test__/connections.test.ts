import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { AppData } from "~/repositories/AppDataRepository";
import { encryptGitHubConnectionPayload } from "../connection-crypto";
import {
	GITHUB_CONNECTION_APP_ID,
	getGitHubAppConnectionForInstallation,
	getGitHubAppConnectionForUserInstallation,
	getGitHubAppConnectionForUserRepo,
	listGitHubAppConnectionsForUser,
} from "../connections";

const JWT_SECRET = "jwt-secret";
const USER_ID = 42;

async function createEncryptedRecord(params: {
	recordId: string;
	installationId: number;
	itemId?: string;
	repositories?: string[];
	webhookSecret?: string;
}): Promise<AppData> {
	const encrypted = await encryptGitHubConnectionPayload({
		jwtSecret: JWT_SECRET,
		userId: USER_ID,
		payload: {
			app_id: "123456",
			private_key: "line1\\nline2",
			installation_id: params.installationId,
			webhook_secret: params.webhookSecret,
			repositories: params.repositories,
		},
	});

	return {
		id: params.recordId,
		user_id: USER_ID,
		app_id: GITHUB_CONNECTION_APP_ID,
		item_id: params.itemId ?? String(params.installationId),
		item_type: "github_installation",
		data: JSON.stringify({ encrypted }),
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
	};
}

describe("github connections", () => {
	it("returns the matching user connection for a repository", async () => {
		const getAppDataByUserAndApp = vi.fn().mockResolvedValue([
			await createEncryptedRecord({
				recordId: "record-1",
				installationId: 1001,
				repositories: ["owner/other"],
			}),
			await createEncryptedRecord({
				recordId: "record-2",
				installationId: 1002,
				repositories: ["owner/repo"],
			}),
		]);

		const context = {
			env: { JWT_SECRET },
			repositories: {
				appData: {
					getAppDataByUserAndApp,
				},
			},
		} as unknown as ServiceContext;

		const connection = await getGitHubAppConnectionForUserRepo(
			context,
			USER_ID,
			"owner/repo",
		);

		expect(getAppDataByUserAndApp).toHaveBeenCalledWith(
			USER_ID,
			GITHUB_CONNECTION_APP_ID,
		);
		expect(connection).toMatchObject({
			appId: "123456",
			privateKey: "line1\nline2",
			installationId: 1002,
		});
	});

	it("returns the connection by installation id", async () => {
		const getAppDataByAppAndItemId = vi.fn().mockResolvedValue(
			await createEncryptedRecord({
				recordId: "record-installation",
				installationId: 3001,
				webhookSecret: "webhook-secret",
			}),
		);

		const context = {
			env: { JWT_SECRET },
			repositories: {
				appData: {
					getAppDataByAppAndItemId,
				},
			},
		} as unknown as ServiceContext;

		const connection = await getGitHubAppConnectionForInstallation(
			context,
			3001,
		);

		expect(getAppDataByAppAndItemId).toHaveBeenCalledWith(
			GITHUB_CONNECTION_APP_ID,
			"3001",
		);
		expect(connection).toMatchObject({
			appId: "123456",
			installationId: 3001,
			webhookSecret: "webhook-secret",
		});
	});

	it("returns the user-scoped connection by installation id", async () => {
		const getAppDataByUserAppAndItem = vi.fn().mockResolvedValue([
			await createEncryptedRecord({
				recordId: "record-installation-user",
				installationId: 8001,
			}),
		]);

		const context = {
			env: { JWT_SECRET },
			repositories: {
				appData: {
					getAppDataByUserAppAndItem,
				},
			},
		} as unknown as ServiceContext;

		const connection = await getGitHubAppConnectionForUserInstallation(
			context,
			USER_ID,
			8001,
		);

		expect(getAppDataByUserAppAndItem).toHaveBeenCalledWith(
			USER_ID,
			GITHUB_CONNECTION_APP_ID,
			"8001",
			"github_installation",
		);
		expect(connection).toMatchObject({
			appId: "123456",
			installationId: 8001,
		});
	});

	it("lists user connections in updated order", async () => {
		const getAppDataByUserAndApp = vi.fn().mockResolvedValue([
			{
				...(await createEncryptedRecord({
					recordId: "record-old",
					installationId: 9101,
					repositories: ["owner/old"],
				})),
				updated_at: "2026-01-01T00:00:00.000Z",
			},
			{
				...(await createEncryptedRecord({
					recordId: "record-new",
					installationId: 9102,
					repositories: ["owner/new"],
					webhookSecret: "secret",
				})),
				updated_at: "2026-01-02T00:00:00.000Z",
			},
		]);

		const context = {
			env: { JWT_SECRET },
			repositories: {
				appData: {
					getAppDataByUserAndApp,
				},
			},
		} as unknown as ServiceContext;

		const summaries = await listGitHubAppConnectionsForUser(context, USER_ID);

		expect(summaries).toHaveLength(2);
		expect(summaries[0]).toMatchObject({
			installationId: 9102,
			repositories: ["owner/new"],
			hasWebhookSecret: true,
		});
		expect(summaries[1]).toMatchObject({
			installationId: 9101,
			repositories: ["owner/old"],
			hasWebhookSecret: false,
		});
	});

	it("rejects when JWT secret is not configured", async () => {
		const getAppDataByAppAndItemId = vi.fn().mockResolvedValue(
			await createEncryptedRecord({
				recordId: "record-installation",
				installationId: 3001,
			}),
		);

		const context = {
			env: {},
			repositories: {
				appData: {
					getAppDataByAppAndItemId,
				},
			},
		} as unknown as ServiceContext;

		await expect(
			getGitHubAppConnectionForInstallation(context, 3001),
		).rejects.toThrow("JWT secret not configured");
	});
});
