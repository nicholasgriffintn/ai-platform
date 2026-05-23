import type { ConversationModeMetadata } from "@assistant/schemas";

import { normalizeMessage } from "~/lib/messages";
import type { MessageContent } from "~/types";

export type AttachmentData = {
	type: string;
	data: string;
	name?: string;
	markdown?: string;
};

export function prepareUserMessage(
	input: string,
	attachmentData: AttachmentData | undefined,
	model?: string,
	conversationMode?: ConversationModeMetadata,
) {
	const data = conversationMode ? { conversationMode } : undefined;

	if (!attachmentData) {
		return normalizeMessage({
			role: "user",
			content: input.trim(),
			id: crypto.randomUUID(),
			created: Date.now(),
			model,
			data,
		});
	}

	const contentItems: MessageContent[] = [
		{
			type: "text",
			text: input.trim(),
		},
	];

	if (attachmentData.type === "image") {
		contentItems.push({
			type: "image_url",
			image_url: {
				url: attachmentData.data,
				detail: "auto",
			},
		});
	} else if (attachmentData.type === "document") {
		contentItems.push({
			type: "document_url",
			document_url: {
				url: attachmentData.data,
				name: attachmentData.name,
			},
		});
	} else if (attachmentData.type === "audio") {
		contentItems.push({
			type: "input_audio",
			input_audio: {
				data: attachmentData.data,
				format: attachmentData.name?.toLowerCase().endsWith(".wav") ? "wav" : "mp3",
			},
		});
	} else if (attachmentData.type === "markdown_document" && attachmentData.markdown) {
		contentItems.push({
			type: "markdown_document",
			markdown_document: {
				markdown: attachmentData.markdown,
				name: attachmentData.name,
			},
		});
	}

	return normalizeMessage({
		role: "user",
		content: contentItems,
		id: crypto.randomUUID(),
		created: Date.now(),
		model,
		data,
	});
}
