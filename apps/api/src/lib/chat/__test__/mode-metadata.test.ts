import { describe, expect, it } from "vitest";

import {
	buildAssistantMessageData,
	buildConversationModeMetadataFromRequestOptions,
	buildUserMessageData,
	resolveChatConversationMode,
	resolveChatPromptMode,
} from "../mode-metadata";

describe("buildConversationModeMetadataFromRequestOptions", () => {
	it("does not turn coding execution into a conversation mode", () => {
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

		expect(metadata).toBeUndefined();
		expect(
			buildUserMessageData({
				sandbox: {
					enabled: true,
					repo: "owner/repo",
					taskType: "bug-fix",
				},
			}),
		).toEqual({ codingTaskType: "bug-fix" });
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

		expect(resolveChatPromptMode(options as any)).toBe("council");
		expect(buildConversationModeMetadataFromRequestOptions(options as any)?.mode).toBe("council");
	});

	it("builds sms metadata from request options", () => {
		const options = {
			sms: {
				enabled: true,
				from: "+15551234567",
				to: "+15557654321",
			},
		};

		expect(resolveChatPromptMode(options as any)).toBe("sms");
		expect(buildConversationModeMetadataFromRequestOptions(options as any)).toEqual({
			mode: "sms",
			requestOptions: options,
			smsSettings: {
				from: "+15551234567",
				to: "+15557654321",
			},
		});
	});

	it("builds background metadata without duplicating request options", () => {
		expect(resolveChatPromptMode(undefined)).toBeUndefined();
		expect(resolveChatConversationMode(undefined, true)).toBe("background");
		expect(buildConversationModeMetadataFromRequestOptions(undefined, true)).toEqual({
			mode: "background",
		});
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
