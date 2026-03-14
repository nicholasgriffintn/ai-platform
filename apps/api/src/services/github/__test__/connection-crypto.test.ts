import { describe, expect, it } from "vitest";

import { ErrorType } from "~/utils/errors";
import {
	decryptGitHubConnectionPayload,
	encryptGitHubConnectionPayload,
} from "../connection-crypto";

describe("github connection crypto", () => {
	it("encrypts and decrypts connection payload with user-scoped key", async () => {
		const encrypted = await encryptGitHubConnectionPayload({
			jwtSecret: "jwt-secret-value",
			userId: 42,
			payload: {
				app_id: "123456",
				private_key: "private-key",
				installation_id: 789,
				repositories: ["owner/repo"],
			},
		});

		const decrypted = await decryptGitHubConnectionPayload({
			jwtSecret: "jwt-secret-value",
			userId: 42,
			encrypted,
		});

		expect(decrypted).toMatchObject({
			app_id: "123456",
			private_key: "private-key",
			installation_id: 789,
			repositories: ["owner/repo"],
		});
	});

	it("fails decryption with wrong user id", async () => {
		const encrypted = await encryptGitHubConnectionPayload({
			jwtSecret: "jwt-secret-value",
			userId: 42,
			payload: {
				app_id: "123456",
				private_key: "private-key",
				installation_id: 789,
			},
		});

		await expect(
			decryptGitHubConnectionPayload({
				jwtSecret: "jwt-secret-value",
				userId: 43,
				encrypted,
			}),
		).rejects.toMatchObject({
			message:
				"GitHub App connection could not be decrypted. Reconnect the GitHub App installation.",
			type: ErrorType.CONFLICT_ERROR,
			statusCode: 409,
		});
	});
});
