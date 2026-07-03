import { describe, expect, it } from "vitest";
import type { Message } from "~/types";
import {
	buildCompactionPlan,
	buildFallbackSummary,
	type CompactionPlanMessage,
	estimateConversationTokens,
	estimateMessageTokens,
	formatMessagesForSummary,
} from "../compaction";

function createMessage(id: string, content: string, role: Message["role"] = "user") {
	return {
		id,
		role,
		content,
	} as Message;
}

describe("session compaction planning", () => {
	it("does not compact conversations below the token threshold", () => {
		const messages = Array.from({ length: 10 }, (_, index) =>
			createMessage(`m-${index}`, "short message"),
		);

		const plan = buildCompactionPlan(messages, {
			contextWindow: 8192,
		});

		expect(plan.shouldCompact).toBe(false);
		expect(plan.messagesToArchive).toHaveLength(0);
		expect(plan.messagesToKeep).toHaveLength(10);
	});

	it("does not double-count the latest user message when estimating token pressure", () => {
		const latestUserMessage = "x".repeat(180);
		const messages = [
			createMessage("older", "old message", "assistant"),
			createMessage("latest", latestUserMessage, "user"),
		];

		const plan = buildCompactionPlan(messages, {
			contextWindow: 100,
		});

		expect(plan.shouldCompact).toBe(false);
		expect(plan.messagesToArchive).toEqual([]);
		expect(plan.messagesToKeep).toEqual(messages);
	});

	it("auto compaction is based on token pressure, not message count", () => {
		const messages = Array.from({ length: 3 }, (_, index) =>
			createMessage(`m-${index}`, `${"x".repeat(8000)}-${index}`),
		);

		const plan = buildCompactionPlan(messages, {
			contextWindow: 4096,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.length).toBeGreaterThan(0);
		expect(plan.messagesToKeep.length).toBeLessThan(messages.length);
	});

	it("compacts long conversations and keeps recent messages", () => {
		const largeContent = "x".repeat(1200);
		const messages = Array.from({ length: 32 }, (_, index) =>
			createMessage(`m-${index}`, `${largeContent}-${index}`),
		);

		const plan = buildCompactionPlan(messages, {
			contextWindow: 4096,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.length).toBeGreaterThan(0);
		expect(plan.messagesToKeep.length).toBeLessThan(messages.length);
		expect(plan.messagesToKeep.slice(-8).map((message) => message.id)).toEqual(
			messages.slice(-8).map((message) => message.id),
		);
	});

	it("manual compaction bypasses the token threshold and archives active history", () => {
		const messages = Array.from({ length: 30 }, (_, index) =>
			createMessage(`m-${index}`, `message ${index}`),
		);

		const plan = buildCompactionPlan(messages, {
			mode: "manual",
			contextWindow: 128000,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.map((message) => message.id)).toContain("m-0");
		expect(plan.messagesToArchive).toHaveLength(30);
		expect(plan.messagesToKeep).toEqual([]);
	});

	it("manual compaction archives short active history", () => {
		const messages = Array.from({ length: 6 }, (_, index) =>
			createMessage(`m-${index}`, `message ${index}`),
		);

		const plan = buildCompactionPlan(messages, {
			mode: "manual",
			contextWindow: 128000,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.map((message) => message.id)).toEqual([
			"m-0",
			"m-1",
			"m-2",
			"m-3",
			"m-4",
			"m-5",
		]);
		expect(plan.messagesToKeep).toEqual([]);
	});

	it("off compaction mode disables automatic compaction", () => {
		const largeContent = "x".repeat(1200);
		const messages = Array.from({ length: 32 }, (_, index) =>
			createMessage(`m-${index}`, `${largeContent}-${index}`),
		);

		const plan = buildCompactionPlan(messages, {
			mode: "off",
			contextWindow: 4096,
		});

		expect(plan.shouldCompact).toBe(false);
		expect(plan.messagesToArchive).toHaveLength(0);
		expect(plan.messagesToKeep).toEqual(messages);
	});

	it("respects keepRecentMessages override", () => {
		const largeContent = "x".repeat(1200);
		const messages = Array.from({ length: 36 }, (_, index) =>
			createMessage(`m-${index}`, `${largeContent}-${index}`),
		);

		const plan = buildCompactionPlan(messages, {
			contextWindow: 4096,
			keepRecentMessages: 4,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToKeep.slice(-4).map((message) => message.id)).toEqual(
			messages.slice(-4).map((message) => message.id),
		);
	});

	it("archives existing snapshot messages when compacting again", () => {
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

		const plan = buildCompactionPlan(messages, {
			contextWindow: 4096,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.map((message) => message.id)).toContain("snap");
		expect(plan.messagesToKeep.find((message) => message.id === "snap")).toBeUndefined();
		expect(plan.messagesToKeep.find((message) => message.id === "sys")).toBeDefined();
	});

	it("preserves instruction messages when compacting active history", () => {
		const largeContent = "x".repeat(800);
		const messages: Message[] = [
			createMessage("sys", "system instructions", "system"),
			createMessage("dev", "developer instructions", "developer"),
			...Array.from({ length: 28 }, (_, index) =>
				createMessage(`m-${index}`, `${largeContent}-${index}`),
			),
		];

		const plan = buildCompactionPlan(messages, {
			contextWindow: 4096,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.map((message) => message.id)).not.toContain("sys");
		expect(plan.messagesToArchive.map((message) => message.id)).not.toContain("dev");
		expect(plan.messagesToKeep.find((message) => message.id === "sys")).toBeDefined();
		expect(plan.messagesToKeep.find((message) => message.id === "dev")).toBeDefined();
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

		const estimate = estimateConversationTokens(messages);
		expect(estimate).toBeGreaterThan(0);
	});

	it("does not compact when token count is below the default 32k threshold", () => {
		// 24 messages with short content should be well below 32000 * 0.7
		const messages = Array.from({ length: 24 }, (_, index) =>
			createMessage(`m-${index}`, "hello world"),
		);

		const plan = buildCompactionPlan(messages);

		expect(plan.shouldCompact).toBe(false);
	});

	it("does not count display-only compaction markers toward automatic compaction pressure", () => {
		const messages: Message[] = [
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted ".repeat(1000),
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			} as Message,
			createMessage("user-1", "short question"),
			createMessage("assistant-1", "short answer", "assistant"),
		];

		const plan = buildCompactionPlan(messages, {
			contextWindow: 200,
			keepRecentMessages: 1,
		});

		expect(plan.shouldCompact).toBe(false);
		expect(plan.messagesToKeep).toEqual(messages);
	});

	it("does not count malformed assistant-shaped compaction metadata toward automatic compaction pressure", () => {
		const messages: CompactionPlanMessage[] = [
			{
				id: "malformed-compaction",
				role: "assistant",
				content: "Context compacted ".repeat(1000),
				parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
			},
			createMessage("user-1", "short question"),
			createMessage("assistant-1", "short answer", "assistant"),
		];

		const plan = buildCompactionPlan(messages, {
			contextWindow: 200,
			keepRecentMessages: 1,
		});

		expect(plan.shouldCompact).toBe(false);
		expect(plan.messagesToKeep).toEqual(messages);
	});

	it("does not archive malformed assistant-shaped compaction metadata during manual compaction", () => {
		const malformedCompactionMessage: CompactionPlanMessage = {
			id: "malformed-compaction",
			role: "assistant",
			content: "Context compacted",
			parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
		};
		const messages = [
			malformedCompactionMessage,
			createMessage("user-1", "short question"),
			createMessage("assistant-1", "short answer", "assistant"),
		];

		const plan = buildCompactionPlan(messages, {
			mode: "manual",
			contextWindow: 128000,
		});

		expect(plan.shouldCompact).toBe(true);
		expect(plan.messagesToArchive.map((message) => message.id)).toEqual(["user-1", "assistant-1"]);
		expect(plan.messagesToKeep).toEqual([malformedCompactionMessage]);
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
		expect(estimateMessageTokens(toolMsg)).toBeLessThan(estimateMessageTokens(userMsg));
	});
});

describe("formatMessagesForSummary", () => {
	it("labels messages by role", () => {
		const messages: Message[] = [
			createMessage("1", "what is the answer?", "user"),
			createMessage("2", "the answer is 42", "assistant"),
			createMessage("3", "follow the contract", "developer"),
		];
		const output = formatMessagesForSummary(messages);
		expect(output).toContain("[User]");
		expect(output).toContain("[Assistant]");
		expect(output).toContain("[Developer]");
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
		const messages = Array.from({ length: 10 }, (_, i) => createMessage(`m-${i}`, "a".repeat(200)));
		const output = formatMessagesForSummary(messages, 500);
		expect(output.length).toBeLessThanOrEqual(520); // small slack for label overhead
	});

	it("includes archived visible message text stored in parts", () => {
		const output = formatMessagesForSummary([
			{
				id: "assistant-parts",
				role: "assistant",
				content: "",
				parts: [
					{ type: "reasoning", text: "Internal reasoning", collapsed: true },
					{ type: "text", text: "Visible answer from parts" },
				],
			} as Message,
		]);

		expect(output).toContain("[Assistant]: Visible answer from parts");
		expect(output).not.toContain("Internal reasoning");
	});

	it("excludes thinking content from archived message content arrays", () => {
		const output = formatMessagesForSummary([
			{
				id: "assistant-thinking",
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "Internal chain of thought", signature: "sig" },
					{ type: "text", text: "Visible answer from content" },
				],
			} as Message,
		]);

		expect(output).toContain("[Assistant]: Visible answer from content");
		expect(output).not.toContain("Internal chain of thought");
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

	it("includes message text stored in parts", () => {
		const summary = buildFallbackSummary([
			{
				id: "assistant-parts",
				role: "assistant",
				content: "",
				parts: [{ type: "text", text: "Fallback text from parts" }],
			} as Message,
		]);

		expect(summary).toContain("Fallback text from parts");
	});

	it("excludes reasoning-only parts from fallback snapshots", () => {
		const summary = buildFallbackSummary([
			{
				id: "assistant-reasoning",
				role: "assistant",
				content: "",
				parts: [{ type: "reasoning", text: "Private reasoning", collapsed: true }],
			} as Message,
		]);

		expect(summary).toBe("Conversation snapshot recorded.");
	});

	it("excludes thinking-only content arrays from fallback snapshots", () => {
		const summary = buildFallbackSummary([
			{
				id: "assistant-thinking",
				role: "assistant",
				content: [{ type: "thinking", thinking: "Private thinking", signature: "sig" }],
			} as Message,
		]);

		expect(summary).toBe("Conversation snapshot recorded.");
	});

	it("returns a placeholder when messages have no textual body", () => {
		const summary = buildFallbackSummary([
			{
				id: "empty-assistant",
				role: "assistant",
				content: "",
			} as Message,
		]);

		expect(summary).toBe("Conversation snapshot recorded.");
	});
});
