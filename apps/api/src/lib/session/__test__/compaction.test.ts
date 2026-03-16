import { describe, expect, it } from "vitest";
import type { Message } from "~/types";
import {
	buildCompactionPlan,
	buildFallbackSummary,
	estimateConversationTokens,
	estimateMessageTokens,
	formatMessagesForSummary,
} from "../compaction";

function createMessage(
	id: string,
	content: string,
	role: Message["role"] = "user",
) {
	return {
		id,
		role,
		content,
	} as Message;
}

describe("session compaction planning", () => {
	it("does not compact short conversations", () => {
		const messages = Array.from({ length: 10 }, (_, index) =>
			createMessage(`m-${index}`, "short message"),
		);

		const plan = buildCompactionPlan(messages, "latest", {
			contextWindow: 8192,
		});

		expect(plan.shouldCompact).toBe(false);
		expect(plan.messagesToArchive).toHaveLength(0);
		expect(plan.messagesToKeep).toHaveLength(10);
	});

	it("compacts long conversations and keeps recent messages", () => {
		const largeContent = "x".repeat(1200);
		const messages = Array.from({ length: 32 }, (_, index) =>
			createMessage(`m-${index}`, `${largeContent}-${index}`),
		);

		const plan = buildCompactionPlan(messages, "latest", {
			contextWindow: 4096,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.length).toBeGreaterThan(0);
		expect(plan.messagesToKeep.length).toBeLessThan(messages.length);
		expect(plan.messagesToKeep.slice(-8).map((message) => message.id)).toEqual(
			messages.slice(-8).map((message) => message.id),
		);
	});

	it("respects keepRecentMessages override", () => {
		const largeContent = "x".repeat(1200);
		const messages = Array.from({ length: 36 }, (_, index) =>
			createMessage(`m-${index}`, `${largeContent}-${index}`),
		);

		const plan = buildCompactionPlan(messages, "latest", {
			contextWindow: 4096,
			keepRecentMessages: 4,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToKeep.slice(-4).map((message) => message.id)).toEqual(
			messages.slice(-4).map((message) => message.id),
		);
	});

	it("preserves existing snapshot messages", () => {
		const largeContent = "x".repeat(800);
		const messages: Message[] = [
			createMessage("sys", "system", "system"),
			{
				id: "snap",
				role: "assistant",
				content: "Conversation snapshot",
				parts: [{ type: "snapshot", summary: "summary" }],
			} as Message,
			...Array.from({ length: 28 }, (_, index) =>
				createMessage(`m-${index}`, `${largeContent}-${index}`),
			),
		];

		const plan = buildCompactionPlan(messages, "latest", {
			contextWindow: 4096,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(
			plan.messagesToArchive.find((message) => message.id === "snap"),
		).toBe(undefined);
		expect(
			plan.messagesToKeep.find((message) => message.id === "snap"),
		).toBeDefined();
	});

	it("estimates tokens for mixed message content", () => {
		const messages: Message[] = [
			createMessage("1", "plain text"),
			{
				id: "2",
				role: "assistant",
				content: [{ type: "text", text: "chunked content" }],
			} as Message,
		];

		const estimate = estimateConversationTokens(messages, "latest");
		expect(estimate).toBeGreaterThan(0);
	});

	it("does not compact when token count is below the default 32k threshold", () => {
		// 24 messages with short content should be well below 32000 * 0.7
		const messages = Array.from({ length: 24 }, (_, index) =>
			createMessage(`m-${index}`, "hello world"),
		);

		const plan = buildCompactionPlan(messages, "hello");

		expect(plan.shouldCompact).toBe(false);
	});
});

describe("token estimation", () => {
	it("estimates prose at ~4 chars per token", () => {
		const msg = createMessage("1", "a".repeat(400));
		// 400 / 4 + 4 = 104
		expect(estimateMessageTokens(msg)).toBe(104);
	});

	it("estimates tool results at ~6 chars per token", () => {
		const msg: Message = {
			id: "t1",
			role: "tool",
			content: "a".repeat(600),
		} as Message;
		// 400 truncated (TOOL_RESULT_SUMMARY_LIMIT) / 6 + 4 ≈ 71
		expect(estimateMessageTokens(msg)).toBe(71);
	});

	it("tool messages are estimated lower than equivalent user messages", () => {
		const content = "x".repeat(800);
		const userMsg = createMessage("u", content, "user");
		const toolMsg: Message = { id: "t", role: "tool", content } as Message;
		expect(estimateMessageTokens(toolMsg)).toBeLessThan(
			estimateMessageTokens(userMsg),
		);
	});
});

describe("formatMessagesForSummary", () => {
	it("labels messages by role", () => {
		const messages: Message[] = [
			createMessage("1", "what is the answer?", "user"),
			createMessage("2", "the answer is 42", "assistant"),
		];
		const output = formatMessagesForSummary(messages);
		expect(output).toContain("[User]");
		expect(output).toContain("[Assistant]");
	});

	it("includes tool name in tool result label", () => {
		const msg: Message = {
			id: "t",
			role: "tool",
			name: "web_search",
			content: "some result",
		} as Message;
		const output = formatMessagesForSummary([msg]);
		expect(output).toContain("[Tool result](web_search)");
	});

	it("truncates tool output to TOOL_RESULT_SUMMARY_LIMIT", () => {
		const msg: Message = {
			id: "t",
			role: "tool",
			name: "bash",
			content: "z".repeat(2000),
		} as Message;
		const output = formatMessagesForSummary([msg]);
		// Should contain truncation indicator
		expect(output).toContain("…");
		// Should not contain the full 2000-char string
		expect(output.length).toBeLessThan(600);
	});

	it("respects maxCharacters limit", () => {
		const messages = Array.from({ length: 10 }, (_, i) =>
			createMessage(`m-${i}`, "a".repeat(200)),
		);
		const output = formatMessagesForSummary(messages, 500);
		expect(output.length).toBeLessThanOrEqual(520); // small slack for label overhead
	});
});

describe("buildFallbackSummary", () => {
	it("returns a placeholder for empty messages", () => {
		expect(buildFallbackSummary([])).toBe("Conversation snapshot recorded.");
	});

	it("labels messages with role prefixes", () => {
		const messages: Message[] = [
			createMessage("1", "hello", "user"),
			createMessage("2", "hi there", "assistant"),
		];
		const summary = buildFallbackSummary(messages);
		expect(summary).toContain("[User]");
		expect(summary).toContain("[Assistant]");
	});
});
