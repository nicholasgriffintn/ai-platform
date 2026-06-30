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
			[
				{
					type: "markdown_document",
					data: "https://files.test/doc.md",
					name: "doc.md",
					markdown: "# Heading",
				},
			],
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

	it("builds multimodal content for artifact selection attachments", () => {
		const message = prepareUserMessage(
			"Make this firmer",
			[
				{
					type: "artifact_selection",
					name: "selection from Launch plan",
					artifact: {
						identifier: "launch-plan",
						type: "text/markdown",
						title: "Launch plan",
					},
					selectedText: "This paragraph needs work.",
					selectionStart: 12,
					selectionEnd: 38,
				},
			],
			"model-1",
		);

		expect(message.content).toEqual([
			{ type: "text", text: "Make this firmer" },
			{
				type: "artifact_selection",
				artifact_selection: {
					artifact: {
						identifier: "launch-plan",
						type: "text/markdown",
						title: "Launch plan",
					},
					selectedText: "This paragraph needs work.",
					selectionStart: 12,
					selectionEnd: 38,
				},
			},
		]);
	});

	it("builds audio content with the expected format", () => {
		const message = prepareUserMessage(
			"transcribe",
			[
				{
					type: "audio",
					data: "https://files.test/audio.wav",
					name: "audio.wav",
				},
			],
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

	it("builds multimodal content for multiple attachments", () => {
		const message = prepareUserMessage(
			"compare these",
			[
				{
					type: "document",
					data: "https://files.test/spec.pdf",
					name: "spec.pdf",
				},
				{
					type: "markdown_document",
					data: "https://files.test/readme.md",
					name: "readme.md",
					markdown: "# Readme",
				},
			],
			"model-1",
		);

		expect(message.content).toEqual([
			{ type: "text", text: "compare these" },
			{
				type: "document_url",
				document_url: {
					url: "https://files.test/spec.pdf",
					name: "spec.pdf",
				},
			},
			{
				type: "markdown_document",
				markdown_document: {
					markdown: "# Readme",
					name: "readme.md",
				},
			},
		]);
	});
});
