import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";
import { describe, expect, it } from "vitest";

import {
	decryptAuthChallengePayload,
	encryptAuthChallengePayload,
} from "~/services/auth/challengeEncryption";

const challenge: AuthChallengeRecord = {
	tokenHash: "token-hash",
	provider: "otp",
	kind: "mfa_setup",
	payload: { secret: "totp-secret" },
	createdAt: new Date("2026-08-08T10:00:00.000Z"),
	expiresAt: new Date("2026-08-08T10:05:00.000Z"),
	attempts: 0,
};
const keyMaterial = "a-test-key-material-with-at-least-32-bytes";

describe("authentication challenge encryption", () => {
	it("encrypts payloads and binds them to challenge metadata", async () => {
		const encrypted = await encryptAuthChallengePayload(challenge, keyMaterial);

		expect(JSON.stringify(encrypted)).not.toContain("totp-secret");
		await expect(decryptAuthChallengePayload(challenge, encrypted, keyMaterial)).resolves.toEqual(
			challenge.payload,
		);
		await expect(
			decryptAuthChallengePayload(
				{ ...challenge, tokenHash: "different-token-hash" },
				encrypted,
				keyMaterial,
			),
		).rejects.toThrow("could not be decrypted");
	});

	it("rejects legacy plaintext payloads", async () => {
		expect(() => decryptAuthChallengePayload(challenge, challenge.payload, keyMaterial)).toThrow(
			"not encrypted",
		);
	});
});
