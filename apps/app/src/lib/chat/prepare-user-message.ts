import type { ConversationModeMetadata } from "@assistant/schemas";

import type { AttachmentData } from "~/lib/chat/attachments";
import { normalizeMessage } from "~/lib/messages";
import type { MessageContent } from "~/types";

export function prepareUserMessage(
	input: string,
	attachments: readonly AttachmentData[] | undefined,
	model?: string,
	conversationMode?: ConversationModeMetadata,
) {
	const data = conversationMode ? { conversationMode } : undefined;

	if (!attachments?.length) {
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

	for (const attachment of attachments) {
		if (attachment.type === "image") {
			contentItems.push({
				type: "image_url",
				image_url: {
					url: attachment.data,
					detail: "auto",
				},
			});
		} else if (attachment.type === "document") {
			contentItems.push({
				type: "document_url",
				document_url: {
					url: attachment.data,
					name: attachment.name,
				},
			});
		} else if (attachment.type === "audio") {
			contentItems.push({
				type: "input_audio",
				input_audio: {
					data: attachment.data,
					format: attachment.name?.toLowerCase().endsWith(".wav") ? "wav" : "mp3",
				},
			});
		} else if (attachment.type === "markdown_document" && attachment.markdown) {
			contentItems.push({
				type: "markdown_document",
				markdown_document: {
					markdown: attachment.markdown,
					name: attachment.name,
				},
			});
		}
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
