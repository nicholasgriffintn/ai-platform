import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";
import { buildConversationModeMetadata, getConversationModeMetadata } from "../conversation-mode";

describe("conversation mode metadata", () => {
	it("builds sms metadata with request options", () => {
		const metadata = buildConversationModeMetadata({
			mode: "sms",
			requestOptions: {
				options: {
					sms: {
						enabled: true,
						from: "+15551234567",
						to: "+15557654321",
					},
				},
			},
		});

		expect(metadata).toMatchObject({
			mode: "sms",
			requestOptions: {
				sms: {
					enabled: true,
					from: "+15551234567",
					to: "+15557654321",
				},
			},
			smsSettings: {
				from: "+15551234567",
				to: "+15557654321",
			},
		});
	});

	it("does not persist background transport options in conversation metadata", () => {
		const metadata = buildConversationModeMetadata({
			mode: "background",
		});

		expect(metadata).toEqual({
			mode: "background",
		});
	});

	it("reads the first valid mode metadata from conversation messages", () => {
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Project task",
			messages: [
				{
					id: "message-1",
					role: "user",
					content: "Fix it",
					data: {
						conversationMode: { mode: "sms" },
					},
				},
			],
		};

		expect(getConversationModeMetadata(conversation)).toEqual({ mode: "sms" });
	});
});
