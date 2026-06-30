import { describe, expect, it } from "vitest";

import type { ArtifactProps } from "~/types/artifact";
import {
	buildArtifactDownload,
	createArtifactSelectionAttachment,
	findLatestArtifactByIdentifier,
	isDocumentArtifact,
} from "../artifacts";

describe("artifact utilities", () => {
	it("classifies Markdown and plain text artifacts as editable documents", () => {
		expect(isDocumentArtifact({ type: "text/markdown" })).toBe(true);
		expect(
			isDocumentArtifact({
				type: "application/vnd.polychat.document",
			}),
		).toBe(true);
		expect(
			isDocumentArtifact({
				type: "application/vnd.code",
				language: "typescript",
			}),
		).toBe(false);
	});

	it("builds a safe document download filename and MIME type", () => {
		const artifact: ArtifactProps = {
			identifier: "project-plan",
			type: "text/markdown",
			title: "Project Plan: Q3/Q4",
			content: "# Plan",
		};

		expect(buildArtifactDownload(artifact, artifact.content)).toEqual({
			filename: "project-plan-q3-q4.md",
			mimeType: "text/markdown;charset=utf-8",
			content: "# Plan",
		});
	});

	it("creates structured artifact selection attachments", () => {
		const attachment = createArtifactSelectionAttachment({
			artifact: {
				identifier: "launch-plan",
				type: "text/markdown",
				title: "Launch plan",
				content: "# Launch\n\nTighten this paragraph.",
			},
			selectedText: "Tighten this paragraph.",
			selectionStart: 10,
			selectionEnd: 33,
		});

		expect(attachment).toEqual({
			type: "artifact_selection",
			name: "selection from Launch plan",
			artifact: {
				identifier: "launch-plan",
				type: "text/markdown",
				title: "Launch plan",
			},
			selectedText: "Tighten this paragraph.",
			selectionStart: 10,
			selectionEnd: 33,
		});
	});

	it("finds the latest streamed artifact content by identifier", () => {
		const latest = findLatestArtifactByIdentifier(
			[
				{
					role: "assistant",
					content:
						'<artifact identifier="launch-plan" type="text/markdown" title="Launch plan">First draft</artifact>',
				},
				{
					role: "assistant",
					content:
						'<artifact identifier="launch-plan" type="text/markdown" title="Launch plan">First draft\nStreaming second paragraph',
				},
			],
			"launch-plan",
		);

		expect(latest?.content).toBe("First draft\nStreaming second paragraph");
	});
});
