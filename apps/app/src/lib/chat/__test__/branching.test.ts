import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import {
	canBranchFromMessage,
	createBranchConversation,
	createBranchMetadata,
	getBranchPoint,
} from "../branching";

const messages = [
	{ id: "user-1", role: "user", content: "Question" },
	{ id: "assistant-1", role: "assistant", content: "Answer" },
	{ id: "tool-1", role: "tool", content: "Tool" },
] as Message[];

describe("conversation branching", () => {
	it("branches from user messages by generating a new response", () => {
		expect(getBranchPoint(messages, "user-1")).toEqual({
			message: messages[0],
			messages: [messages[0]],
			shouldGenerateResponse: true,
		});
	});

	it("branches from assistant messages without generating another assistant response", () => {
		expect(getBranchPoint(messages, "assistant-1")).toEqual({
			message: messages[1],
			messages: [messages[0], messages[1]],
			shouldGenerateResponse: false,
		});
	});

	it("rejects non-branchable messages", () => {
		expect(canBranchFromMessage(messages[2])).toBe(false);
		expect(getBranchPoint(messages, "tool-1")).toBeNull();
	});

	it("builds branch metadata and conversation parent fields consistently", () => {
		expect(createBranchMetadata("conversation-1", "assistant-1")).toEqual({
			branch_of: JSON.stringify({
				conversation_id: "conversation-1",
				message_id: "assistant-1",
			}),
		});

		expect(
			createBranchConversation({
				conversation: {
					id: "conversation-1",
					title: "Original",
					messages,
				},
				conversationId: "branch-1",
				isLocalOnly: false,
				messages: [messages[0], messages[1]],
				parentConversationId: "conversation-1",
				parentMessageId: "assistant-1",
			}),
		).toEqual(
			expect.objectContaining({
				id: "branch-1",
				title: "Original",
				messages: [messages[0], messages[1]],
				parent_conversation_id: "conversation-1",
				parent_message_id: "assistant-1",
				isLocalOnly: false,
			}),
		);
	});
});
