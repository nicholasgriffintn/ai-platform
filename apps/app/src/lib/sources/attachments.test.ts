import { describe, expect, it } from "vitest";
import type { Source } from "@ngriffin_uk/polychat-schemas";

import { createSourceAttachment } from "./attachments";

const source: Source = {
	id: "source-1",
	createdByUserId: 1,
	projectId: "project-1",
	conversationId: null,
	connectionId: null,
	kind: "text",
	title: "Launch brief",
	status: "available",
	content: "Launch in October.",
	provider: null,
	externalUri: null,
	vectorId: null,
	metadata: {},
	file: null,
	createdAt: "2026-08-11T00:00:00.000Z",
	updatedAt: null,
};

describe("createSourceAttachment", () => {
	it("turns stored source content into model-readable context", () => {
		expect(createSourceAttachment(source, "https://api.test/sources/source-1/content")).toEqual({
			type: "markdown_document",
			data: "https://api.test/sources/source-1/content",
			name: "Launch brief",
			markdown: "# Launch brief\n\nLaunch in October.",
		});
	});

	it("uses the private content route for unconverted images", () => {
		expect(
			createSourceAttachment(
				{
					...source,
					kind: "file",
					content: null,
					file: {
						key: "uploads/1/images/source.png",
						mimeType: "image/png",
						filename: "source.png",
						byteSize: 100,
					},
				},
				"https://api.test/sources/source-1/content",
			),
		).toEqual({
			type: "image",
			data: "https://api.test/sources/source-1/content",
			name: "source.png",
		});
	});

	it("returns no attachment when a source has no usable material", () => {
		expect(createSourceAttachment({ ...source, content: null }, "unused")).toBeNull();
	});

	it("does not attach raw media that the selected model cannot read", () => {
		const audioSource: Source = {
			...source,
			kind: "file",
			content: null,
			file: {
				key: "uploads/1/audio/source.wav",
				mimeType: "audio/wav",
				filename: "source.wav",
				byteSize: 100,
			},
		};

		expect(
			createSourceAttachment(audioSource, "https://api.test/sources/source-1/content", {
				supportsAudio: false,
				supportsDocuments: true,
				supportsImages: true,
			}),
		).toBeNull();
	});
});
