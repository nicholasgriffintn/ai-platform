import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { decryptGitHubConnectionPayload } from "../connection-crypto";
import { GITHUB_CONNECTION_APP_ID } from "../connections";
import { upsertGitHubConnectionForUser } from "../manage-connections";

const JWT_SECRET = "jwt-secret";
const USER_ID = 42;

describe("upsertGitHubConnectionForUser", () => {
	it("creates a new encrypted connection record when one does not exist", async () => {
		const getAppDataByUserAppAndItem = vi.fn().mockResolvedValue([]);
		const createAppDataWithItem = vi.fn().mockResolvedValue(undefined);
		const updateAppData = vi.fn().mockResolvedValue(undefined);

		const context = {
			env: { JWT_SECRET },
			repositories: {
				appData: {
					getAppDataByUserAppAndItem,
					createAppDataWithItem,
					updateAppData,
				},
			},
		} as unknown as ServiceContext;

		await upsertGitHubConnectionForUser(context, USER_ID, {
			installationId: 5001,
			appId: "123456",
			privateKey: "private-key",
			webhookSecret: "secret",
			repositories: ["Owner/Repo", "owner/repo", "owner/other"],
		});

		expect(getAppDataByUserAppAndItem).toHaveBeenCalledWith(
			USER_ID,
			GITHUB_CONNECTION_APP_ID,
			"5001",
			"github_installation",
		);
		expect(updateAppData).not.toHaveBeenCalled();
		expect(createAppDataWithItem).toHaveBeenCalledTimes(1);

		const createdPayload = createAppDataWithItem.mock.calls[0][4] as {
			encrypted: {
				v: 1;
				iv: string;
				data: string;
			};
		};

		const decrypted = await decryptGitHubConnectionPayload({
			jwtSecret: JWT_SECRET,
			userId: USER_ID,
			encrypted: createdPayload.encrypted,
		});

		expect(decrypted).toMatchObject({
			app_id: "123456",
			private_key: "private-key",
			installation_id: 5001,
			webhook_secret: "secret",
			repositories: ["owner/repo", "owner/other"],
		});
	});

	it("updates an existing encrypted connection record", async () => {
		const getAppDataByUserAppAndItem = vi.fn().mockResolvedValue([
			{
				id: "record-1",
			},
		]);
		const createAppDataWithItem = vi.fn().mockResolvedValue(undefined);
		const updateAppData = vi.fn().mockResolvedValue(undefined);

		const context = {
			env: { JWT_SECRET },
			repositories: {
				appData: {
					getAppDataByUserAppAndItem,
					createAppDataWithItem,
					updateAppData,
				},
			},
		} as unknown as ServiceContext;

		await upsertGitHubConnectionForUser(context, USER_ID, {
			installationId: 6001,
			appId: "123456",
			privateKey: "updated-private-key",
		});

		expect(updateAppData).toHaveBeenCalledTimes(1);
		expect(updateAppData.mock.calls[0][0]).toBe("record-1");
		expect(createAppDataWithItem).not.toHaveBeenCalled();
	});

	it("fails when JWT secret is not configured", async () => {
		const context = {
			env: {},
			repositories: {
				appData: {
					getAppDataByUserAppAndItem: vi.fn(),
					createAppDataWithItem: vi.fn(),
					updateAppData: vi.fn(),
				},
			},
		} as unknown as ServiceContext;

		await expect(
			upsertGitHubConnectionForUser(context, USER_ID, {
				installationId: 7001,
				appId: "123456",
				privateKey: "private-key",
			}),
		).rejects.toThrow("JWT secret not configured");
	});
});
