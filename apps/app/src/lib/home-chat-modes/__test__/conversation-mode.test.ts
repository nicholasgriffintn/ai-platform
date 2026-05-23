import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";
import { buildConversationModeMetadata, getConversationModeMetadata } from "../conversation-mode";

describe("conversation mode metadata", () => {
	it("builds sandbox metadata with local settings", () => {
		const metadata = buildConversationModeMetadata({
			mode: "sandbox",
			requestOptions: {
				sandbox: {
					enabled: true,
					repo: "owner/repo",
					installationId: 123,
					taskType: "bug-fix",
					promptStrategy: "bug-fix",
					shouldCommit: false,
					timeoutSeconds: 900,
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

		expect(metadata).toMatchObject({
			mode: "sandbox",
			sandboxSettings: {
				repoKey: "123:owner/repo",
				taskType: "bug-fix",
				promptStrategy: "bug-fix",
				timeoutSecondsInput: "900",
				shouldCommit: false,
			},
		});
	});

	it("reads the first valid mode metadata from conversation messages", () => {
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Sandbox task",
			messages: [
				{
					id: "message-1",
					role: "user",
					content: "Fix it",
					data: {
						conversationMode: {
							mode: "sandbox",
							sandboxSettings: {
								repoKey: "123:owner/repo",
								taskType: "bug-fix",
							},
						},
					},
				},
			],
		};

		expect(getConversationModeMetadata(conversation)).toMatchObject({
			mode: "sandbox",
			sandboxSettings: {
				repoKey: "123:owner/repo",
				taskType: "bug-fix",
			},
		});
	});
});
