import type { Source } from "@assistant/schemas";

import type { AttachmentData } from "~/lib/chat/attachments";

export interface SourceAttachmentCapabilities {
	supportsAudio: boolean;
	supportsDocuments: boolean;
	supportsImages: boolean;
}

export function createSourceAttachment(
	source: Source,
	contentUrl: string,
	capabilities?: SourceAttachmentCapabilities,
): AttachmentData | null {
	const content = source.content?.trim();
	if (content) {
		return {
			type: "markdown_document",
			data: contentUrl,
			name: source.title,
			markdown: `# ${source.title}\n\n${content}`,
		};
	}

	if (source.file?.mimeType.startsWith("image/") && capabilities?.supportsImages !== false) {
		return {
			type: "image",
			data: contentUrl,
			name: source.file.filename ?? source.title,
		};
	}

	if (source.file?.mimeType.startsWith("audio/") && capabilities?.supportsAudio !== false) {
		return {
			type: "audio",
			data: contentUrl,
			name: source.file.filename ?? source.title,
		};
	}

	if (source.file?.mimeType === "application/pdf" && capabilities?.supportsDocuments !== false) {
		return {
			type: "document",
			data: contentUrl,
			name: source.file.filename ?? source.title,
		};
	}

	if (source.externalUri) {
		return {
			type: "markdown_document",
			data: source.externalUri,
			name: source.title,
			markdown: `# ${source.title}\n\n${source.externalUri}`,
		};
	}

	return null;
}
