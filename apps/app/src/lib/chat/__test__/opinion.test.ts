import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import {
	buildOpinionRequestPrompt,
	canRequestOpinionForMessage,
	getOpinionSourceContext,
	shouldPromoteOpinionRequest,
} from "../opinion";

function message(
	id: string,
	role: Message["role"],
	content: string,
	data?: Message["data"],
): Message {
	return {
		id,
		role,
		content,
		created: 1,
		model: "test-model",
		data,
	};
}

describe("opinion helpers", () => {
	it("allows opinion requests only on the latest assistant answer", () => {
		const messages = [
			message("user-1", "user", "Question"),
			message("assistant-1", "assistant", "Answer"),
			message("user-2", "user", "Follow up"),
		];

		expect(canRequestOpinionForMessage(messages, "assistant-1")).toBe(false);
		expect(canRequestOpinionForMessage(messages.slice(0, 2), "assistant-1")).toBe(true);
	});

	it("does not suggest another opinion on an opinion response", () => {
		const messages = [
			message("user-1", "user", "Question"),
			message("assistant-1", "assistant", "Answer"),
			message("user-2", "user", "Second opinion request", {
				opinion: {
					mode: "second-opinion",
					sourceMessageId: "assistant-1",
					modelIds: ["gpt-4"],
				},
			}),
			message("assistant-2", "assistant", "Another answer"),
		];

		expect(canRequestOpinionForMessage(messages, "assistant-2")).toBe(false);
	});

	it("promotes the action when the user asked for verification", () => {
		const messages = [
			message("user-1", "user", "Can you double-check this plan?"),
			message("assistant-1", "assistant", "Answer"),
		];

		expect(shouldPromoteOpinionRequest(messages, "assistant-1")).toBe(true);
	});

	it("builds prompts for single-model and consensus requests", () => {
		expect(
			buildOpinionRequestPrompt({
				mode: "second-opinion",
				modelIds: ["gpt-4"],
			}),
		).toContain("Second opinion request");
		expect(
			buildOpinionRequestPrompt({
				mode: "consensus",
				modelIds: ["gpt-4", "claude"],
			}),
		).toContain("Consensus request");
	});

	it("includes the source question and answer in the review prompt", () => {
		const messages = [
			message("user-1", "user", "Is this deployment plan safe?"),
			message("assistant-1", "assistant", "The plan is mostly safe."),
		];
		const sourceContext = getOpinionSourceContext(messages, "assistant-1");

		const prompt = buildOpinionRequestPrompt(
			{
				mode: "second-opinion",
				modelIds: ["gpt-4"],
			},
			sourceContext,
		);

		expect(prompt).toContain("Source user message:");
		expect(prompt).toContain("Is this deployment plan safe?");
		expect(prompt).toContain("Assistant answer to review:");
		expect(prompt).toContain("The plan is mostly safe.");
	});

	it("falls back to reasoning content when an assistant answer has no text content", () => {
		const messages: Message[] = [
			message("user-1", "user", "hi"),
			{
				id: "assistant-1",
				role: "assistant",
				content: "",
				created: 1,
				model: "test-model",
				reasoning: {
					collapsed: false,
					content: "Hey Nicholas! How can I help you today?",
				},
			},
		];

		expect(canRequestOpinionForMessage(messages, "assistant-1")).toBe(true);
		expect(getOpinionSourceContext(messages, "assistant-1")?.assistantAnswer).toBe(
			"Hey Nicholas! How can I help you today?",
		);
	});
});
