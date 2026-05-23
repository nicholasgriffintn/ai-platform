import type { Message, MessageContent } from "~/types";

type ChatRequestMessage = {
	id?: string;
	role: Message["role"];
	content: Message["content"];
	data?: Message["data"];
	name?: Message["name"];
	parts?: Message["parts"];
	tool_calls?: Message["tool_calls"];
};

type ChatRequestContent =
	| {
			type: "text";
			text?: string;
	  }
	| {
			type: "image_url";
			image_url: NonNullable<MessageContent["image_url"]>;
	  }
	| {
			type: "input_audio";
			input_audio: NonNullable<MessageContent["input_audio"]>;
	  }
	| {
			type: "document_url";
			document_url: NonNullable<MessageContent["document_url"]>;
	  }
	| {
			type: "markdown_document";
			markdown_document: NonNullable<MessageContent["markdown_document"]>;
	  };

const chatRequestContentTypes = new Set([
	"text",
	"image_url",
	"input_audio",
	"document_url",
	"markdown_document",
]);

function normaliseMessageParts(parts: unknown): Message["parts"] | undefined {
	if (!Array.isArray(parts)) {
		return undefined;
	}

	const normalised = parts.flatMap((part) => {
		if (!part || typeof part !== "object") {
			return [];
		}

		if ("type" in part && typeof part.type === "string") {
			return [part as NonNullable<Message["parts"]>[number]];
		}

		if ("text" in part && typeof part.text === "string") {
			return [
				{
					type: "text",
					text: part.text,
				} as NonNullable<Message["parts"]>[number],
			];
		}

		return [];
	});

	return normalised.length > 0 ? normalised : undefined;
}

export function normalizeMessage(message: Message): Message {
	let content = message.content;
	const reasoning = message.reasoning;
	let newReasoning: string | null = null;
	const parts = normaliseMessageParts((message as Message & { parts?: unknown }).parts);

	if (typeof content === "string") {
		const formatted = formatMessageContent(content);
		content = formatted.content;

		if (formatted.reasoning) {
			newReasoning = formatted.reasoning;
		}
	} else if (Array.isArray(content)) {
		const thinkingPart = content.find((item) => item.type === "thinking" && item.thinking);
		if (thinkingPart) {
			newReasoning = thinkingPart.thinking ?? null;
		}
	} else if (content && !Array.isArray(content) && typeof content === "object") {
		content = JSON.stringify(content);
	}

	if (!newReasoning && parts?.length) {
		const reasoningFromParts = parts
			.filter(
				(part): part is Extract<NonNullable<Message["parts"]>[number], { type: "reasoning" }> =>
					part.type === "reasoning",
			)
			.map((part) => part.text)
			.join("\n")
			.trim();
		if (reasoningFromParts) {
			newReasoning = reasoningFromParts;
		}
	}

	if (typeof content === "string" && (!content || content.trim() === "") && parts?.length) {
		const textFromParts = parts
			.filter(
				(part): part is Extract<NonNullable<Message["parts"]>[number], { type: "text" }> =>
					part.type === "text",
			)
			.map((part) => part.text)
			.join("\n")
			.trim();
		if (textFromParts) {
			content = textFromParts;
		}
	}

	const now = Date.now();

	const finalReasoning = newReasoning
		? {
				collapsed: true,
				content: newReasoning,
			}
		: reasoning;

	return {
		...message,
		role: message.role,
		content: content,
		id: message.id || crypto.randomUUID(),
		created: message.created || message.timestamp || now,
		timestamp: message.timestamp || message.created || now,
		model: message.model || "",
		citations: message.citations || null,
		reasoning: finalReasoning,
		parts,
		log_id: message.log_id,
		tool_calls: message.tool_calls,
		usage: message.usage,
		data: message.data,
		status: message.status,
	};
}

function toChatRequestContentPart(part: MessageContent): ChatRequestContent | null {
	if (!chatRequestContentTypes.has(part.type)) {
		return null;
	}

	if (part.type === "text") {
		return { type: "text", text: part.text || "" };
	}

	if (part.type === "image_url" && part.image_url?.url) {
		return {
			type: "image_url",
			image_url: {
				url: part.image_url.url,
				detail: part.image_url.detail,
			},
		};
	}

	if (part.type === "input_audio" && part.input_audio) {
		return {
			type: "input_audio",
			input_audio: part.input_audio,
		};
	}

	if (part.type === "document_url" && part.document_url?.url) {
		return {
			type: "document_url",
			document_url: part.document_url,
		};
	}

	if (part.type === "markdown_document" && part.markdown_document?.markdown) {
		return {
			type: "markdown_document",
			markdown_document: {
				markdown: part.markdown_document.markdown,
				name: part.markdown_document.name,
			},
		};
	}

	return null;
}

function serialiseContentForChatRequest(message: Message): Message["content"] {
	if (typeof message.content === "string") {
		return message.content;
	}

	if (!Array.isArray(message.content)) {
		return JSON.stringify(message.content);
	}

	const content = message.content
		.map((part) => toChatRequestContentPart(part))
		.filter((part): part is ChatRequestContent => part !== null);

	if (content.length === 0) {
		return getMessageTextContent(message);
	}

	if (message.role !== "user" && content.every((part) => part.type === "text")) {
		return content
			.map((part) => part.text || "")
			.join("\n")
			.trim();
	}

	return content;
}

function serialiseToolCallsForChatRequest(toolCalls: Message["tool_calls"]): Message["tool_calls"] {
	return Array.isArray(toolCalls) ? toolCalls : undefined;
}

export function serialiseMessageForChatRequest(message: Message): ChatRequestMessage {
	const requestMessage: ChatRequestMessage = {
		id: message.id || undefined,
		role: message.role,
		content: serialiseContentForChatRequest(message),
		data: message.data || undefined,
		name: message.name || undefined,
		parts: message.parts,
	};

	const toolCalls = serialiseToolCallsForChatRequest(message.tool_calls);
	if (toolCalls) {
		requestMessage.tool_calls = toolCalls;
	}

	return requestMessage;
}

export function serialiseMessagesForChatRequest(messages: Message[]): ChatRequestMessage[] {
	return messages.map((message) => serialiseMessageForChatRequest(message));
}

export function getMessageTextContent(message: Pick<Message, "content" | "parts">): string {
	if (typeof message.content === "string") {
		return message.content.trim();
	}

	if (Array.isArray(message.content)) {
		const text = message.content
			.map((item) => (item.type === "text" ? item.text || "" : ""))
			.join("\n")
			.trim();

		if (text) {
			return text;
		}
	}

	if (Array.isArray(message.parts)) {
		return message.parts
			.map((part) => (part.type === "text" ? part.text : ""))
			.join("\n")
			.trim();
	}

	return "";
}

export function formatMessageContent(messageContent: string): {
	content: string;
	reasoning: string;
} {
	let reasoning = "";
	const messageContentIsArray = Array.isArray(messageContent);
	if (messageContentIsArray) {
		return {
			content: messageContent,
			reasoning: "",
		};
	}

	const analysisMatch = messageContent.match(/<analysis>([\s\S]*?)(?:<\/analysis>|$)/s);
	const thinkMatch = messageContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/s);

	if (analysisMatch) {
		reasoning = typeof analysisMatch[1] === "string" ? analysisMatch[1].trim() : "";
	}

	if (thinkMatch) {
		reasoning = typeof thinkMatch[1] === "string" ? thinkMatch[1].trim() : "";
	}

	let cleanedContent = messageContent;

	cleanedContent = cleanedContent.replace(/<analysis>.*?(?:<\/analysis>|$)/gs, "");
	cleanedContent = cleanedContent.replace(/<think>.*?(?:<\/think>|$)/gs, "");

	const answerRegex = /<answer>([\s\S]*?)(<\/answer>|$)/g;
	let match = answerRegex.exec(cleanedContent);
	while (match !== null) {
		const fullMatch = match[0];
		const contentOnly = match[1];
		cleanedContent = cleanedContent.replace(fullMatch, contentOnly);
		match = answerRegex.exec(cleanedContent);
	}

	cleanedContent = cleanedContent
		.replace(/<answer>/g, "")
		.replace(/<\/answer>/g, "")
		.trim();

	return {
		content: cleanedContent,
		reasoning,
	};
}

export const formattedMessageContent = (role: Message["role"], originalContent: string) => {
	let content = originalContent;
	const reasoning: Array<{ type: string; content: string; isOpen: boolean }> = [];
	const artifacts: Array<{
		identifier: string;
		type: string;
		language: string;
		title: string | undefined;
		content: string;
		placeholder: string;
		isOpen: boolean;
	}> = [];

	const thinkRegex = /<think>([\s\S]*?)(<\/think>|$)/g;
	while (true) {
		const match = thinkRegex.exec(content);
		if (match === null) break;

		reasoning.push({
			type: "think",
			content: match[1].trim(),
			isOpen: !match[0].includes("</think>"),
		});
		content = content.replace(match[0], "");
	}

	const analysisRegex = /<analysis>([\s\S]*?)(<\/analysis>|$)/g;
	while (true) {
		const analysisMatch = analysisRegex.exec(content);
		if (analysisMatch === null) break;

		const isStreaming = !analysisMatch[0].includes("</analysis>");
		reasoning.push({
			type: "analysis",
			content: analysisMatch[1].trim(),
			isOpen: isStreaming,
		});
		content = content.replace(analysisMatch[0], "");
	}

	if (role === "assistant") {
		const artifactRegex = /<artifact\s+([^>]*)>([\s\S]*?)(<\/artifact>|$)/g;
		let artifactMatch: RegExpExecArray | null = null;
		const tempContent = content;

		artifactRegex.lastIndex = 0;

		while (true) {
			artifactMatch = artifactRegex.exec(tempContent);
			if (artifactMatch === null) {
				break;
			}

			const attributesStr = artifactMatch[1];
			const artifactContent = typeof artifactMatch[2] === "string" ? artifactMatch[2].trim() : "";
			const isOpen = !artifactMatch[0].includes("</artifact>");

			const identifier = attributesStr.match(/identifier="([^"]*)"/)?.[1] || "";
			if (!identifier) {
				console.warn("Artifact missing identifier:", artifactMatch[0]?.substring(0, 50));
				continue;
			}

			const getAttributeValue = (attr: string) => {
				const regex = new RegExp(`${attr}="([^"]*)"`, "i");
				const match = attributesStr.match(regex);
				return match ? match[1] : null;
			};

			const type = getAttributeValue("type") || "";
			const language = getAttributeValue("language") || type || "text";
			const title = getAttributeValue("title") || undefined;

			artifacts.push({
				identifier,
				type,
				language,
				title,
				content: artifactContent,
				placeholder: `[[ARTIFACT:${identifier}]]`,
				isOpen: isOpen,
			});
		}
	}

	for (const artifact of artifacts) {
		const artifactRegex = new RegExp(
			`<artifact[^>]*identifier="${artifact.identifier}"[^>]*>[\\s\\S]*?(?:</artifact>|$)`,
			"g",
		);
		content = content.replace(artifactRegex, artifact.placeholder);
	}

	const answerRegex = /<answer>([\s\S]*?)(<\/answer>|$)/g;
	while (true) {
		const answerMatch = answerRegex.exec(content);
		if (answerMatch === null) break;

		content = content.replace(answerMatch[0], answerMatch[1]);
	}

	return {
		content: typeof content === "string" ? content.trim() : "",
		reasoning,
		artifacts,
	};
};
