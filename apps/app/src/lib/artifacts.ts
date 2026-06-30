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
const INLINE_PREVIEW_TYPES = new Set(["text/html", "application/vnd.html"]);
const INLINE_PREVIEW_LANGUAGES = new Set(["html"]);
const CODE_TYPES = new Set([
	"application/mermaid",
	"application/vnd.code",
	"application/vnd.react",
	"application/vnd.mermaid",
	"image/svg+xml",
	"text/css",
	"text/html",
	"text/javascript",
	"text/jsx",
]);
const CODE_LANGUAGES = new Set([
	"css",
	"html",
	"javascript",
	"js",
	"jsx",
	"mermaid",
	"react",
	"svg",
	"ts",
	"tsx",
	"typescript",
]);

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

export function isInlinePreviewArtifact(
	artifact: Pick<ArtifactProps, "display" | "type" | "language">,
): boolean {
	if (artifact.display !== "inline") {
		return false;
	}

	const type = artifact.type.toLowerCase();
	const language = artifact.language?.toLowerCase();

	return (
		INLINE_PREVIEW_TYPES.has(type) || (language ? INLINE_PREVIEW_LANGUAGES.has(language) : false)
	);
}

export function isCodeArtifact(artifact: Pick<ArtifactProps, "type" | "language">): boolean {
	const type = artifact.type.toLowerCase();
	const language = artifact.language?.toLowerCase();

	return CODE_TYPES.has(type) || (language ? CODE_LANGUAGES.has(language) : false);
}

export function isStylesheetArtifact(artifact: Pick<ArtifactProps, "type" | "language">): boolean {
	const type = artifact.type.toLowerCase();
	const language = artifact.language?.toLowerCase();

	return type === "text/css" || language === "css";
}

export function canCombineArtifacts(
	artifacts: Array<Pick<ArtifactProps, "type" | "language">>,
): boolean {
	if (artifacts.length < 2) return false;

	const hasScript = artifacts.some((artifact) => {
		const type = artifact.type.toLowerCase();
		const language = artifact.language?.toLowerCase();

		return (
			type === "text/javascript" ||
			type === "text/jsx" ||
			type === "application/vnd.react" ||
			language === "javascript" ||
			language === "js" ||
			language === "jsx" ||
			language === "react" ||
			language === "tsx" ||
			language === "typescript" ||
			language === "ts"
		);
	});

	const hasStylesheet = artifacts.some((artifact) => isStylesheetArtifact(artifact));

	return hasScript && hasStylesheet;
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
