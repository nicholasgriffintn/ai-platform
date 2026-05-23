import type { ContentType, Message, MessageContent } from "~/types";
import { safeParseJson } from "~/utils/json";
import { isRecord } from "~/utils/objects";

type OpenAIResponsesInputItem = Record<string, unknown>;

interface MessageFormatOptions {
	maxTokens?: number;
	truncationStrategy?: "head" | "tail" | "middle";
	provider?: string;
	model?: string;
	system_prompt?: string;
}

/**
 * Formats messages for any provider
 * Handles specific message formats for each provider
 * @param messages - The messages to format
 * @param options - The options for formatting
 * @returns The formatted messages
 */
export class MessageFormatter {
	static stringifyMessageContent(content: unknown): string {
		if (typeof content === "string") {
			return content;
		}

		if (Array.isArray(content)) {
			return content.map((item) => MessageFormatter.stringifyMessageContent(item)).join("\n");
		}

		if (isRecord(content)) {
			if (typeof content.text === "string") {
				return content.text;
			}

			if (typeof content.content === "string") {
				return content.content;
			}

			return JSON.stringify(content);
		}

		return "";
	}

	static formatOpenAIResponsesInput(messages: Message[]): OpenAIResponsesInputItem[] {
		return messages.flatMap((message) => MessageFormatter.formatOpenAIResponsesMessage(message));
	}

	static formatOpenAIResponsesInstructions(
		messages: Message[],
		systemPrompt?: string,
	): string | undefined {
		const seen = new Set<string>();
		const instructionParts: string[] = [];

		MessageFormatter.appendUniqueInstructionPart(instructionParts, seen, systemPrompt);
		for (const message of messages) {
			if (message.role === "system" || message.role === "developer") {
				MessageFormatter.appendUniqueInstructionPart(
					instructionParts,
					seen,
					MessageFormatter.stringifyMessageContent(message.content),
				);
			}
		}

		return instructionParts.length ? instructionParts.join("\n\n") : undefined;
	}

	static ensureAssistantAfterTool(messages: Message[]): Message[] {
		if (
			messages.length >= 2 &&
			messages[messages.length - 1].role === "user" &&
			messages[messages.length - 2].role === "tool"
		) {
			return [
				...messages.slice(0, messages.length - 1),
				{ role: "assistant", content: "" } as Message,
				messages[messages.length - 1],
			];
		}
		return messages;
	}

	static formatMessages(messages: Message[], options: MessageFormatOptions = {}): Message[] {
		const {
			maxTokens = 0,
			truncationStrategy = "tail",
			provider = "default",
			model,
			system_prompt,
		} = options;

		let formattedMessages = messages;

		if (maxTokens > 0 && MessageFormatter.countTokens(formattedMessages) > maxTokens) {
			formattedMessages = MessageFormatter.truncateMessages(
				formattedMessages,
				maxTokens,
				truncationStrategy,
			);
		}

		formattedMessages = MessageFormatter.formatMessageContent(formattedMessages, provider);

		if (system_prompt) {
			formattedMessages = MessageFormatter.addsystem_prompt(
				formattedMessages,
				system_prompt,
				provider,
				model,
			);
		}

		if (provider === "mistral") {
			formattedMessages = MessageFormatter.ensureAssistantAfterTool(formattedMessages);
		}
		return formattedMessages;
	}

	private static formatMessageContent(messages: Message[], provider: string): Message[] {
		const formattedMessages: Message[] = [];
		for (const message of messages) {
			const content = MessageFormatter.formatContent(message.content, provider);

			if (message.role === "tool") {
				if (
					message.data &&
					typeof message.data === "object" &&
					!Array.isArray(message.data) &&
					(message.data as { modelContext?: unknown }).modelContext === false
				) {
					continue;
				}

				if (!message.tool_call_id && provider !== "anthropic") {
					continue;
				}

				let stringifiedData = "";
				if (message.data) {
					try {
						stringifiedData = JSON.stringify(message.data);
					} catch {}
				}
				const toolResultContent = `[Tool Response: ${
					message.name || "unknown"
				}] ${typeof content === "string" ? content : JSON.stringify(content)} ${
					stringifiedData ? `\n\nData: ${stringifiedData}` : ""
				}`;

				if (provider === "anthropic") {
					let toolCallArguments = message.tool_call_arguments;
					if (typeof toolCallArguments === "string") {
						toolCallArguments = safeParseJson(toolCallArguments);
					}

					formattedMessages.push({
						role: "assistant",
						content: [
							{
								type: "tool_use" as ContentType,
								id: message.tool_call_id,
								name: message.name || "",
								input: toolCallArguments,
							},
						],
					});

					formattedMessages.push({
						role: "user",
						content: [
							{
								type: "tool_result" as ContentType,
								tool_use_id: message.tool_call_id,
								content: toolResultContent,
							},
						],
					});
					continue;
				}

				const toolMessage: Message = {
					role: "tool",
					content: toolResultContent,
				};

				if (message.tool_call_id) {
					toolMessage.tool_call_id = message.tool_call_id;
				}

				formattedMessages.push(toolMessage);
				continue;
			}

			switch (provider) {
				case "google-ai-studio":
					formattedMessages.push({
						role: message.role,
						parts: Array.isArray(content) ? content : [{ text: content }],
						content: "",
						tool_calls: message.tool_calls,
					} as Message);
					break;
				case "anthropic": {
					let formattedContent: any;

					if (Array.isArray(content) && content.length === 1 && typeof content[0] === "string") {
						formattedContent = [MessageFormatter.createAnthropicTextBlock(content[0])];
					} else if (typeof content === "string") {
						formattedContent = [MessageFormatter.createAnthropicTextBlock(content)];
					} else if (Array.isArray(content)) {
						formattedContent = content;
						if (formattedContent.length > 0) {
							const lastBlock = formattedContent[formattedContent.length - 1];
							if (lastBlock && typeof lastBlock === "object") {
								formattedContent = [
									...formattedContent.slice(0, -1),
									MessageFormatter.addAnthropicCacheControl(lastBlock),
								];
							}
						}
					} else {
						formattedContent = content;
					}

					formattedMessages.push({
						role: message.role,
						content: formattedContent,
					} as Message);
					break;
				}
				default:
					if (Array.isArray(content) && content.length === 1 && typeof content[0] === "string") {
						const newMessage: Message = {
							role: message.role,
							content: content[0],
						};

						if (message.role === "assistant" && message.tool_calls) {
							newMessage.tool_calls = message.tool_calls;
						}

						formattedMessages.push(newMessage);
					} else {
						const newMessage: Message = {
							role: message.role,
							content,
						};

						if (message.role === "assistant" && message.tool_calls) {
							newMessage.tool_calls = message.tool_calls;
						}

						formattedMessages.push(newMessage);
					}
			}
		}
		return formattedMessages;
	}

	private static createAnthropicTextBlock(text: string): Record<string, unknown> {
		return MessageFormatter.addAnthropicCacheControl({
			type: "text" as ContentType,
			text,
		});
	}

	private static addAnthropicCacheControl(block: Record<string, unknown>): Record<string, unknown> {
		if (block.type === "text" && block.text === "") {
			return block;
		}

		return {
			...block,
			cache_control: { type: "ephemeral" },
		};
	}

	private static formatContent(content: Message["content"], provider: string): any {
		if (!Array.isArray(content)) {
			return content;
		}

		switch (provider) {
			case "google-ai-studio":
				return content
					.map((item) => MessageFormatter.formatGoogleAIContent(item))
					.filter((item) => item !== null);
			case "anthropic":
				return content
					.map((item) => MessageFormatter.formatAnthropicContent(item))
					.filter((item) => item !== null);
			case "bedrock":
				return content
					.map((item) => MessageFormatter.formatBedrockContent(item))
					.filter((item) => item !== null);
			case "workers-ai":
			case "ollama":
			case "github-models": {
				const imageItem = content.find(
					(item) => typeof item === "object" && "type" in item && item.type === "image_url",
				);

				if (
					imageItem &&
					typeof imageItem === "object" &&
					"image_url" in imageItem &&
					imageItem.image_url &&
					typeof imageItem.image_url === "object" &&
					"url" in imageItem.image_url
				) {
					return {
						text: content
							.filter((item) => typeof item === "object" && "type" in item && item.type === "text")
							.map((item) => (typeof item === "object" && "text" in item ? item.text : ""))
							.join("\n"),
						image: MessageFormatter.getBase64FromUrl(imageItem.image_url.url),
					};
				}

				return content
					.filter((item) => typeof item === "object" && "type" in item && item.type === "text")
					.map((item) => (typeof item === "object" && "text" in item ? item.text : ""))
					.join("\n");
			}
			default:
				return content.filter(
					(item) => typeof item === "object" && "type" in item && item.type !== "markdown_document",
				);
		}
	}

	private static addsystem_prompt(
		messages: Message[],
		system_prompt: string,
		provider: string,
		_model?: string,
	): Message[] {
		if (!system_prompt) {
			return messages;
		}

		switch (provider) {
			case "anthropic":
			case "bedrock":
			case "google-ai-studio":
				return messages;
			case "openai":
			case "compat":
				return [{ role: "developer", content: system_prompt }, ...messages];
			case "workers-ai":
			case "groq":
			case "ollama":
			case "github-models":
			case "parallel":
			case "exa":
				return [
					{
						role: "system",
						content: system_prompt,
					},
					...messages,
				] as Message[];
			default:
				return [
					{
						role: "system",
						content: [{ type: "text", text: system_prompt }],
					},
					...messages,
				];
		}
	}

	private static countTokens(messages: Message[]): number {
		return messages.reduce(
			(total, msg) =>
				total +
				(typeof msg.content === "string" ? msg.content.length : JSON.stringify(msg.content).length),
			0,
		);
	}

	private static truncateMessages(
		messages: Message[],
		maxTokens: number,
		strategy: "head" | "tail" | "middle",
	): Message[] {
		switch (strategy) {
			case "tail":
				return messages.slice(-Math.floor(messages.length / 2));
			case "head":
				return messages.slice(0, Math.floor(messages.length / 2));
			case "middle": {
				const midPoint = Math.floor(messages.length / 2);
				return messages.slice(
					midPoint - Math.floor(maxTokens / 2),
					midPoint + Math.floor(maxTokens / 2),
				);
			}
		}
	}

	private static appendUniqueInstructionPart(
		parts: string[],
		seen: Set<string>,
		value: unknown,
	): void {
		if (typeof value !== "string") {
			return;
		}

		const text = value.trim();
		if (!text || seen.has(text)) {
			return;
		}

		seen.add(text);
		parts.push(text);
	}

	private static formatOpenAIResponsesMessagePart(
		part: MessageContent,
	): OpenAIResponsesInputItem | null {
		if (part.type === "text" && part.text) {
			return {
				type: "input_text",
				text: part.text,
			};
		}

		if (part.type === "image_url" && part.image_url?.url) {
			return {
				type: "input_image",
				image_url: part.image_url.url,
			};
		}

		if (part.type === "document_url" && part.document_url?.url) {
			return {
				type: "input_file",
				file_url: part.document_url.url,
			};
		}

		const text = MessageFormatter.stringifyMessageContent(part);
		return text ? { type: "input_text", text } : null;
	}

	private static stringifyFunctionArguments(value: unknown): string {
		if (typeof value === "string") {
			return value;
		}

		if (value === undefined || value === null) {
			return "";
		}

		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	private static getResponseFunctionName(tool: Record<string, unknown>): string | undefined {
		if (typeof tool.name === "string") {
			return tool.name;
		}

		if (isRecord(tool.function) && typeof tool.function.name === "string") {
			return tool.function.name;
		}

		return undefined;
	}

	private static getResponseFunctionArguments(tool: Record<string, unknown>): unknown {
		return isRecord(tool.function) ? tool.function.arguments : tool.arguments;
	}

	private static formatOpenAIResponsesFunctionCall(
		toolCall: Record<string, unknown>,
	): OpenAIResponsesInputItem | null {
		const name = MessageFormatter.getResponseFunctionName(toolCall);
		const callId =
			typeof toolCall.call_id === "string"
				? toolCall.call_id
				: typeof toolCall.id === "string"
					? toolCall.id
					: undefined;

		if (!name || !callId) {
			return null;
		}

		return {
			type: "function_call",
			...(toolCall.type === "function_call" && typeof toolCall.id === "string"
				? { id: toolCall.id }
				: {}),
			call_id: callId,
			name,
			arguments: MessageFormatter.stringifyFunctionArguments(
				MessageFormatter.getResponseFunctionArguments(toolCall),
			),
			...(typeof toolCall.status === "string" ? { status: toolCall.status } : {}),
		};
	}

	private static formatOpenAIResponsesToolCalls(message: Message): OpenAIResponsesInputItem[] {
		if (message.role !== "assistant" || !Array.isArray(message.tool_calls)) {
			return [];
		}

		return message.tool_calls
			.map((toolCall) => MessageFormatter.formatOpenAIResponsesFunctionCall(toolCall))
			.filter((toolCall): toolCall is OpenAIResponsesInputItem => toolCall !== null);
	}

	private static formatOpenAIResponsesMessageItem(
		message: Message,
	): OpenAIResponsesInputItem | null {
		if (message.role === "system" || message.role === "developer") {
			return null;
		}

		if (message.role === "tool") {
			if (!message.tool_call_id) {
				return null;
			}

			return {
				type: "function_call_output",
				call_id: message.tool_call_id,
				output: MessageFormatter.stringifyMessageContent(message.content),
			};
		}

		if (Array.isArray(message.content)) {
			const content = message.content
				.map((part) => MessageFormatter.formatOpenAIResponsesMessagePart(part))
				.filter((part): part is OpenAIResponsesInputItem => part !== null);

			return {
				type: "message",
				role: message.role,
				content,
			};
		}

		return {
			type: "message",
			role: message.role,
			content: MessageFormatter.stringifyMessageContent(message.content),
		};
	}

	private static formatOpenAIResponsesMessage(message: Message): OpenAIResponsesInputItem[] {
		const messageItem = MessageFormatter.formatOpenAIResponsesMessageItem(message);
		const toolCalls = MessageFormatter.formatOpenAIResponsesToolCalls(message);

		if (message.role === "assistant" && toolCalls.length > 0 && messageItem?.content === "") {
			return toolCalls;
		}

		return [messageItem, ...toolCalls].filter(
			(item): item is OpenAIResponsesInputItem => item !== null,
		);
	}

	private static formatGoogleAIContent(item: MessageContent): any {
		if (item.type === "text") {
			return { text: item.text };
		}
		if (item.type === "image_url" && item.image_url?.url) {
			return {
				inlineData: {
					mimeType: MessageFormatter.resolveType(item.image_url.url),
					data: MessageFormatter.getBase64FromUrl(item.image_url.url),
				},
			};
		}
		if (item.type === "markdown_document") {
			return null;
		}
		return item;
	}

	private static formatAnthropicContent(item: MessageContent): any {
		if (item.type === "text") {
			if (!item.text) {
				return null;
			}
			return {
				type: "text",
				text: item.text,
			};
		}
		if (item.type === "image_url" && item.image_url?.url) {
			return {
				type: "image",
				source: {
					type: "url",
					url: item.image_url.url,
				},
			};
		}
		if (item.type === "document_url" && item.document_url?.url) {
			return {
				type: "document",
				source: {
					type: "url",
					url: item.document_url.url,
				},
			};
		}
		if (item.type === "markdown_document") {
			return null;
		}

		return item;
	}

	private static formatBedrockContent(item: MessageContent): any {
		if (item.type === "text") {
			return { text: item.text };
		}
		if (typeof item === "string") {
			return { text: item };
		}
		if (item.type === "markdown_document") {
			return null;
		}
		return item;
	}

	private static resolveType(dataUrl: string): string {
		const match = dataUrl.match(/^data:([^;]+);base64,/);
		return match ? match[1] : "application/octet-stream";
	}

	private static getBase64FromUrl(dataUrl: string): string {
		const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
		return base64Match ? base64Match[2] : dataUrl;
	}
}
