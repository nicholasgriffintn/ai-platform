import { describe, expect, it } from "vitest";

import {
	buildAssistantMessageData,
	buildConversationModeMetadataFromRequestOptions,
	resolveChatPromptMode,
} from "../mode-metadata";

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

	it("uses the same mode precedence for prompt and conversation metadata", () => {
		const options = {
			council: { enabled: true, responseMode: "debate" },
			sandbox: { enabled: true, repo: "owner/repo" },
		};

		expect(resolveChatPromptMode(options as any)).toBe("sandbox");
		expect(buildConversationModeMetadataFromRequestOptions(options as any)?.mode).toBe("sandbox");
	});

	it("merges provider response data with council turn metadata", () => {
		expect(
			buildAssistantMessageData({
				responseData: { responseType: "custom" },
				requestOptions: {
					council: {
						enabled: true,
						responseMode: "debate",
						activeMemberId: "security",
						phase: "debate",
					},
				},
				councilRouting: {
					shouldContinue: false,
					nextMemberIds: [],
				},
			}),
		).toMatchObject({
			responseType: "custom",
			council: {
				memberId: "security",
				shouldContinue: false,
			},
		});
	});
});
