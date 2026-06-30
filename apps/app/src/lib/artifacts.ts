import type { ArtifactProps } from "~/types/artifact";
import type { Message } from "~/types";
import type { AttachmentData } from "./chat/attachments";
import { formattedMessageContent } from "./messages";

export interface ArtifactDownload {
	filename: string;
	mimeType: string;
	content: string;
}

const DOCUMENT_TYPES = new Set([
	"text/markdown",
	"text/plain",
	"application/vnd.polychat.document",
]);

const DOCUMENT_LANGUAGES = new Set(["markdown", "md", "plain", "text"]);

const TYPE_EXTENSIONS: Record<string, string> = {
	"application/json": "json",
	"application/mermaid": "mmd",
	"application/vnd.code": "txt",
	"application/vnd.polychat.document": "md",
	"application/vnd.react": "tsx",
	"image/svg+xml": "svg",
	"text/css": "css",
	"text/html": "html",
	"text/javascript": "js",
	"text/jsx": "jsx",
	"text/markdown": "md",
	"text/plain": "txt",
	"text/vnd.mermaid": "mmd",
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
	css: "css",
	html: "html",
	javascript: "js",
	js: "js",
	json: "json",
	jsx: "jsx",
	markdown: "md",
	md: "md",
	mermaid: "mmd",
	python: "py",
	react: "tsx",
	svg: "svg",
	text: "txt",
	ts: "ts",
	tsx: "tsx",
	typescript: "ts",
};

export function isDocumentArtifact(artifact: Pick<ArtifactProps, "type" | "language">): boolean {
	const type = artifact.type.toLowerCase();
	const language = artifact.language?.toLowerCase();

	if (DOCUMENT_TYPES.has(type)) {
		return true;
	}

	return language ? DOCUMENT_LANGUAGES.has(language) : false;
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
				content: item.artifact.content,
			};
		}
	}

	return null;
}

function getArtifactExtension(artifact: Pick<ArtifactProps, "type" | "language">): string {
	const type = artifact.type.toLowerCase();
	const language = artifact.language?.toLowerCase();

	if (TYPE_EXTENSIONS[type]) {
		return TYPE_EXTENSIONS[type];
	}

	if (language && LANGUAGE_EXTENSIONS[language]) {
		return LANGUAGE_EXTENSIONS[language];
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
