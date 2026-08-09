import { describe, expect, it } from "vitest";

import { decryptJsonPayload, encryptJsonPayload } from "~/utils/crypto";

describe("encrypted JSON payloads", () => {
	it("authenticates the supplied storage context", async () => {
		const encrypted = await encryptJsonPayload({
			keyMaterial: "a-test-key-material-with-at-least-32-bytes",
			payload: { secret: "sensitive" },
			additionalData: "challenge:one",
		});

		await expect(
			decryptJsonPayload({
				keyMaterial: "a-test-key-material-with-at-least-32-bytes",
				encrypted,
				additionalData: "challenge:one",
			}),
		).resolves.toEqual({ secret: "sensitive" });
		await expect(
			decryptJsonPayload({
				keyMaterial: "a-test-key-material-with-at-least-32-bytes",
				encrypted,
				additionalData: "challenge:two",
			}),
		).rejects.toThrow("could not be decrypted");
	});
});
