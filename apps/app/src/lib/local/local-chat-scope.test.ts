import { describe, expect, it } from "vitest";

import { getLocalChatScope, isConversationInLocalScope } from "./local-chat-scope";

const conversation = { id: "conversation-1", title: "Private", messages: [] };

describe("local chat scope", () => {
	it("isolates signed-in users on a shared browser profile", () => {
		expect(
			isConversationInLocalScope(
				{ ...conversation, localOwnerScope: getLocalChatScope(42) },
				getLocalChatScope(7),
			),
		).toBe(false);
	});

	it("keeps legacy unscoped chats in the anonymous browser scope", () => {
		expect(isConversationInLocalScope(conversation, getLocalChatScope())).toBe(true);
		expect(isConversationInLocalScope(conversation, getLocalChatScope(42))).toBe(false);
	});
});
