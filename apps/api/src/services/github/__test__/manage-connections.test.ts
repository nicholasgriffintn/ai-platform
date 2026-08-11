import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { decryptGitHubConnectionPayload } from "../connection-crypto";
import { GITHUB_CONNECTION_KIND } from "../connections";
import {
	deleteGitHubConnectionForUser,
	upsertGitHubConnectionFromDefaultAppForUser,
	upsertGitHubConnectionForUser,
} from "../manage-connections";

const JWT_SECRET = "jwt-secret";
const USER_ID = 42;
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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

function context(
	providerConnections: Record<string, unknown>,
	env: Record<string, string> = { JWT_SECRET },
): ServiceContext {
	return { env, repositories: { providerConnections } } as unknown as ServiceContext;
}

describe("GitHub provider connections", () => {
	it("upserts one encrypted provider connection per installation", async () => {
		const providerConnections = { upsertConnection: vi.fn().mockResolvedValue(undefined) };

		await upsertGitHubConnectionForUser(context(providerConnections), USER_ID, {
			installationId: 5001,
			appId: "123456",
			privateKey: PRIVATE_KEY,
			webhookSecret: "secret",
			repositories: ["Owner/Repo", "owner/repo", "owner/other"],
		});

		const saved = providerConnections.upsertConnection.mock.calls[0][0];
		expect(saved).toMatchObject({
			userId: USER_ID,
			provider: "github",
			kind: GITHUB_CONNECTION_KIND,
			externalId: "5001",
		});
		const decrypted = await decryptGitHubConnectionPayload({
			jwtSecret: JWT_SECRET,
			userId: USER_ID,
			encrypted: saved.encryptedData.encrypted,
		});
		expect(decrypted).toMatchObject({
			installation_id: 5001,
			app_id: "123456",
			private_key: PRIVATE_KEY,
			repositories: ["owner/repo", "owner/other"],
		});
	});

	it("deletes only the user's matching installation connection", async () => {
		const providerConnections = { deleteConnection: vi.fn().mockResolvedValue(undefined) };

		await deleteGitHubConnectionForUser(context(providerConnections), USER_ID, 7002);

		expect(providerConnections.deleteConnection).toHaveBeenCalledWith(
			USER_ID,
			"github",
			GITHUB_CONNECTION_KIND,
			"7002",
		);
	});

	it("loads default app credentials without persisting cleartext", async () => {
		const providerConnections = { upsertConnection: vi.fn().mockResolvedValue(undefined) };
		const serviceContext = context(providerConnections, {
			JWT_SECRET,
			GITHUB_APP_ID: "env-app-id",
			GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY.replace(/\n/g, "\\n"),
			GITHUB_APP_WEBHOOK_SECRET: "env-webhook",
		});

		await upsertGitHubConnectionFromDefaultAppForUser(serviceContext, USER_ID, {
			installationId: 8080,
		});

		const saved = providerConnections.upsertConnection.mock.calls[0][0];
		expect(JSON.stringify(saved)).not.toContain(PRIVATE_KEY);
	});

	it("requires an encryption secret", async () => {
		await expect(
			upsertGitHubConnectionForUser(context({}, {}), USER_ID, {
				installationId: 1,
				appId: "app",
				privateKey: PRIVATE_KEY,
			}),
		).rejects.toThrow("JWT secret not configured");
	});
});
