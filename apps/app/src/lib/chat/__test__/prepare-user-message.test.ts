import { describe, expect, it } from "vitest";

import { prepareUserMessage } from "../prepare-user-message";

describe("prepareUserMessage", () => {
	it("builds a text message with conversation mode metadata", () => {
		expect(
			prepareUserMessage("  hello  ", undefined, "model-1", {
				mode: "council",
				requestOptions: { council: { enabled: true } },
			} as any),
		).toMatchObject({
			role: "user",
			content: "hello",
			model: "model-1",
			data: {
				conversationMode: {
					mode: "council",
				},
			},
		});
	});

	it("builds multimodal content for markdown document attachments", () => {
		const message = prepareUserMessage(
			"review this",
			{
				type: "markdown_document",
				data: "https://files.test/doc.md",
				name: "doc.md",
				markdown: "# Heading",
			},
			"model-1",
		);

		expect(message.content).toEqual([
			{ type: "text", text: "review this" },
			{
				type: "markdown_document",
				markdown_document: {
					markdown: "# Heading",
					name: "doc.md",
				},
			},
		]);
	});

	it("builds audio content with the expected format", () => {
		const message = prepareUserMessage(
			"transcribe",
			{
				type: "audio",
				data: "https://files.test/audio.wav",
				name: "audio.wav",
			},
			"model-1",
		);

		expect(message.content).toEqual([
			{ type: "text", text: "transcribe" },
			{
				type: "input_audio",
				input_audio: {
					data: "https://files.test/audio.wav",
					format: "wav",
				},
			},
		]);
	});
});
