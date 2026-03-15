import { describe, expect, it } from "vitest";
import type { Message } from "~/types";
import { buildCompactionPlan, estimateConversationTokens } from "../compaction";

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
});
