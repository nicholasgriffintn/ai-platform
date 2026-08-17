import { formattedMessageContent } from "@ngriffin_uk/polychat-library-chat/messages";
import type { ArtifactProps } from "./artifact";
import { ARTIFACT_LANGUAGE_EXTENSIONS, ARTIFACT_TYPE_EXTENSIONS } from "./artifact-kinds";

import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";

export interface ArtifactDownload {
	filename: string;
	mimeType: string;
	content: string;
}

export function buildArtifactDownload(
	artifact: Pick<ArtifactProps, "identifier" | "type" | "language" | "title">,
	content: string,
): ArtifactDownload {
	return {
		filename: `${safeFilename(artifact.title || artifact.identifier)}.${getArtifactExtension(artifact)}`,
		mimeType: `${artifact.type || "text/plain"};charset=utf-8`,
		content,
	};
}

export function createArtifactSelectionAttachment({
	artifact,
	selectedText,
	selectionStart,
	selectionEnd,
}: {
	artifact: ArtifactProps;
	selectedText: string;
	selectionStart: number;
	selectionEnd: number;
}): AttachmentData {
	const title = artifact.title || artifact.identifier || "Artifact";

	return {
		type: "artifact_selection",
		name: `selection from ${title}`,
		artifact: {
			identifier: artifact.identifier,
			type: artifact.type,
			title: artifact.title,
		},
		selectedText: selectedText.trim(),
		selectionStart,
		selectionEnd,
	};
}

export function findLatestArtifactByIdentifier(
	messages: Array<Pick<Message, "role" | "content">>,
	identifier: string,
): ArtifactProps | null {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (!message || message.role !== "assistant") {
			continue;
		}

		const artifact = findArtifactInContent(message.content, identifier);
		if (artifact) {
			return artifact;
		}
	}

	return null;
}

function findArtifactInContent(
	content: Message["content"],
	identifier: string,
): ArtifactProps | null {
	if (typeof content === "string") {
		const { artifacts } = formattedMessageContent("assistant", content);
		return artifacts.find((artifact) => artifact.identifier === identifier) ?? null;
	}

	if (!Array.isArray(content)) {
		return null;
	}

	for (const item of content) {
		if (item.type === "artifact" && item.artifact?.identifier === identifier) {
			return {
				identifier: item.artifact.identifier,
				type: item.artifact.type,
				language: item.artifact.language,
				title: item.artifact.title,
				display: item.artifact.display,
				content: item.artifact.content,
			};
		}
	}

	return null;
}

function getArtifactExtension(artifact: Pick<ArtifactProps, "type" | "language">): string {
	const type = artifact.type.toLowerCase();
	const language = artifact.language?.toLowerCase();

	if (ARTIFACT_TYPE_EXTENSIONS[type]) {
		return ARTIFACT_TYPE_EXTENSIONS[type];
	}

	if (language && ARTIFACT_LANGUAGE_EXTENSIONS[language]) {
		return ARTIFACT_LANGUAGE_EXTENSIONS[language];
	}

	return "txt";
}

function safeFilename(value: string): string {
	const filename = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return filename || "artifact";
}
