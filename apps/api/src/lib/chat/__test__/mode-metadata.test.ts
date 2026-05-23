import { describe, expect, it } from "vitest";

import { buildConversationModeMetadataFromRequestOptions } from "../mode-metadata";

describe("buildConversationModeMetadataFromRequestOptions", () => {
	it("builds sandbox metadata from request options", () => {
		const metadata = buildConversationModeMetadataFromRequestOptions({
			sandbox: {
				enabled: true,
				repo: "owner/repo",
				installationId: 123,
				taskType: "bug-fix",
				promptStrategy: "bug-fix",
				shouldCommit: false,
				timeoutSeconds: 900,
			},
		});

		expect(metadata).toMatchObject({
			mode: "sandbox",
			requestOptions: {
				sandbox: {
					repo: "owner/repo",
					installationId: 123,
				},
			},
			sandboxSettings: {
				repoKey: "123:owner/repo",
				taskType: "bug-fix",
				promptStrategy: "bug-fix",
				timeoutSecondsInput: "900",
				shouldCommit: false,
			},
		});
	});

	it("builds council metadata from request options", () => {
		const metadata = buildConversationModeMetadataFromRequestOptions({
			council: {
				enabled: true,
				responseMode: "debate",
				memberIds: ["chair"],
			},
		});

		expect(metadata).toMatchObject({
			mode: "council",
			requestOptions: {
				council: {
					enabled: true,
					responseMode: "debate",
					memberIds: ["chair"],
				},
			},
		});
	});
});
