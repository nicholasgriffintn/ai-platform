import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { decryptGitHubConnectionPayload } from "../connection-crypto";
import { GITHUB_CONNECTION_APP_ID } from "../connections";
import {
	deleteGitHubConnectionForUser,
	upsertGitHubConnectionFromDefaultAppForUser,
	upsertGitHubConnectionForUser,
} from "../manage-connections";

const JWT_SECRET = "jwt-secret";
const USER_ID = 42;
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAOpYZtauJOBEzw8c
E2WqXIP7K5hV/jUYb0/GyS1tTHUKokEsi4QLDoL6BuhwZzjmtleOJnZZh48U2GwF
jtvaW8OHq/vqsVlXc5FSlWdJBqOMzq0ef085XLRT3sigfyJ9mWL6MRqTor/Aqk7T
WChfb53l6iB9jBvG9gZewIVIcK31AgMBAAECgYEA5O59cGXpQmoV+UXNMTlPbeO2
P/hqAUagn0esCsPGuGQuBAtXNCR1BcDpdLMyM6U3JquIqX9m7YFIt6ZqXB6iGrAP
i8icTuOspEiTaJHntgnQsGlY+et83H4G68vt8a1XtrMKJdr/9wtqG0yEieWkb2ic
X/RpNhc+5+9rm84CK4ECQQD+Sy6ZehtyhG5CW1/7REF7EXFz0+gCflYzDml5doU1
8OW1Dq/dR4htWUge1CC3m0BpuiN+UlZ4PjXHZTVM4bnVAkEA6+rz93vRsn15Vuoc
176d3Z53m+a7mBpBFkm/r7asY6un8ZbNrh+9xo75G4cB1kJxAH0gVEIpZc9LLINO
HvAToQJAGAqbmT8GIUmL8xIYfPTzC+OWSlEaekHffGw8ZJNj/LmNvhRpZA5DQ7NR
Mjjz7ufqqxRCDstSCYQ4KWXUKDSfEQJBAJ548i7BTsg+Pt7iXkOSOMsg4qmn4UW4
BRaqrYekBsLhEOxY54raqYkSi0UxeEtr0CqK4seWteY8y/t3rGddz2ECQAFPTSve
7K1zgE9MCx03fM+eoGHokyxjzYdNa5t64avGo6FVq/yrPPSFWSAKeeLdvlIb1GpO
Gf3O5Idj3x/bOMk=
-----END PRIVATE KEY-----`;
const TEST_PRIVATE_KEY_ESCAPED = TEST_PRIVATE_KEY.replace(/\n/g, "\\n");

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
			privateKey: TEST_PRIVATE_KEY,
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
			private_key: TEST_PRIVATE_KEY,
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
			privateKey: TEST_PRIVATE_KEY,
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

	it("deletes the user connection for a given installation", async () => {
		const deleteAppDataByUserAppAndItem = vi.fn().mockResolvedValue(undefined);
		const context = {
			repositories: {
				appData: {
					deleteAppDataByUserAppAndItem,
				},
			},
		} as unknown as ServiceContext;

		await deleteGitHubConnectionForUser(context, USER_ID, 7002);

		expect(deleteAppDataByUserAppAndItem).toHaveBeenCalledWith(
			USER_ID,
			GITHUB_CONNECTION_APP_ID,
			"7002",
			"github_installation",
		);
	});

	it("creates a connection from default app env values", async () => {
		const getAppDataByUserAppAndItem = vi.fn().mockResolvedValue([]);
		const createAppDataWithItem = vi.fn().mockResolvedValue(undefined);
		const context = {
			env: {
				JWT_SECRET,
				GITHUB_APP_ID: "env-app-id",
				GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY_ESCAPED,
				GITHUB_APP_WEBHOOK_SECRET: "env-webhook",
			},
			repositories: {
				appData: {
					getAppDataByUserAppAndItem,
					createAppDataWithItem,
					updateAppData: vi.fn(),
				},
			},
		} as unknown as ServiceContext;

		await upsertGitHubConnectionFromDefaultAppForUser(context, USER_ID, {
			installationId: 8080,
		});

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
			app_id: "env-app-id",
			private_key: TEST_PRIVATE_KEY,
			installation_id: 8080,
			webhook_secret: "env-webhook",
		});
	});

	it("fails when default app env values are missing", async () => {
		const context = {
			env: {
				JWT_SECRET,
			},
			repositories: {
				appData: {
					getAppDataByUserAppAndItem: vi.fn(),
					createAppDataWithItem: vi.fn(),
					updateAppData: vi.fn(),
				},
			},
		} as unknown as ServiceContext;

		await expect(
			upsertGitHubConnectionFromDefaultAppForUser(context, USER_ID, {
				installationId: 9090,
			}),
		).rejects.toThrow("Default GitHub App is not configured");
	});
});
