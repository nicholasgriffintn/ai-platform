import type { ChatRole, Message, MessageContent } from "../types";

interface MessageFormatOptions {
	maxTokens?: number;
	truncationStrategy?: "head" | "tail" | "middle";
	provider?: string;
	model?: string;
	system_prompt?: string;
}

// biome-ignore lint/complexity/noStaticOnlyClass: Static utility class
export class MessageFormatter {
	static formatMessages(
		messages: Message[],
		options: MessageFormatOptions = {},
	): Message[] {
		const {
			maxTokens = 0,
			truncationStrategy = "tail",
			provider = "default",
			model,
			system_prompt,
		} = options;

		let formattedMessages = messages.filter((msg) => msg.content);

		if (
			maxTokens > 0 &&
			MessageFormatter.countTokens(formattedMessages) > maxTokens
		) {
			formattedMessages = MessageFormatter.truncateMessages(
				formattedMessages,
				maxTokens,
				truncationStrategy,
			);
		}

		formattedMessages = MessageFormatter.formatMessageContent(
			formattedMessages,
			provider,
		);

		if (system_prompt) {
			formattedMessages = MessageFormatter.addsystem_prompt(
				formattedMessages,
				system_prompt,
				provider,
				model,
			);
		}

		return formattedMessages;
	}

	private static formatMessageContent(
		messages: Message[],
		provider: string,
	): Message[] {
		return messages.map((message) => {
			const content = MessageFormatter.formatContent(message.content, provider);

			if (message.role === "tool") {
				let stringifiedData;
				if (message.data) {
					try {
						stringifiedData = JSON.stringify(message.data);
					} catch (error) {
						stringifiedData = "";
					}
				}

				return {
					role: "assistant",
					content: `[Tool Response: ${message.name || "unknown"}] ${typeof content === "string" ? content : JSON.stringify(content)} ${stringifiedData ? `\n\nData: ${stringifiedData}` : ""}`,
				};
			}

			switch (provider) {
				case "google-ai-studio":
					return {
						role: message.role,
						parts: Array.isArray(content) ? content : [{ text: content }],
						content: "",
					};
				default:
					return {
						role: message.role,
						content,
					};
			}
		});
	}

	private static formatContent(
		content: Message["content"],
		provider: string,
	): any {
		if (!Array.isArray(content)) {
			return content;
		}

		switch (provider) {
			case "google-ai-studio":
				return content.map((item) =>
					MessageFormatter.formatGoogleAIContent(item),
				);
			case "anthropic":
				return content.map((item) =>
					MessageFormatter.formatAnthropicContent(item),
				);
			case "bedrock":
				return content.map((item) =>
					MessageFormatter.formatBedrockContent(item),
				);
			case "workers-ai":
			case "ollama":
			case "github-models": {
				const imageItem = content.find((item) => item.type === "image_url");
				if (imageItem?.image_url?.url) {
					return {
						text: content
							.filter((item) => item.type === "text")
							.map((item) => item.text)
							.join("\n"),
						image: MessageFormatter.getBase64FromUrl(imageItem.image_url.url),
					};
				}

				return content
					.filter((item) => item.type === "text")
					.map((item) => item.text)
					.join("\n");
			}
			default:
				return content;
		}
	}

	private static addsystem_prompt(
		messages: Message[],
		system_prompt: string,
		provider: string,
		model?: string,
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
				return [
					{ role: "developer" as ChatRole, content: system_prompt },
					...messages,
				];
			case "workers-ai":
			case "groq":
			case "ollama":
			case "github-models":
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
						role: "system" as ChatRole,
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
				(typeof msg.content === "string"
					? msg.content.length
					: JSON.stringify(msg.content).length),
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
		return item;
	}

	private static formatAnthropicContent(item: MessageContent): any {
		if (item.type === "text") {
			return { type: "text", text: item.text };
		}
		if (item.type === "image_url" && item.image_url?.url) {
			return {
				type: "image",
				source: {
					type: "base64",
					media_type: MessageFormatter.resolveType(item.image_url.url),
					data: MessageFormatter.getBase64FromUrl(item.image_url.url),
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

		return item;
	}

	private static formatBedrockContent(item: MessageContent): any {
		if (item.type === "text") {
			return { text: item.text };
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

interface ResponseFormatOptions {
	model?: string;
	type?: string[];
}

// biome-ignore lint/complexity/noStaticOnlyClass: CBA
export class ResponseFormatter {
	/**
	 * Format a response from any provider
	 */
	static formatResponse(
		data: any,
		provider: string,
		options: ResponseFormatOptions = {},
	): any {
		const formatter = ResponseFormatter.getFormatter(provider);
		return formatter(data, options);
	}

	/**
	 * Get the appropriate formatter function for a provider
	 */
	private static getFormatter(
		provider: string,
	): (data: any, options: ResponseFormatOptions) => any {
		const formatters: Record<
			string,
			(data: any, options: ResponseFormatOptions) => any
		> = {
			openai: ResponseFormatter.formatOpenAIResponse,
			anthropic: ResponseFormatter.formatAnthropicResponse,
			"google-ai-studio": ResponseFormatter.formatGoogleStudioResponse,
			ollama: ResponseFormatter.formatOllamaResponse,
			bedrock: ResponseFormatter.formatBedrockResponse,
			workers: ResponseFormatter.formatWorkersResponse,
			openrouter: ResponseFormatter.formatOpenRouterResponse,
			groq: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			mistral: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			"perplexity-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			deepseek: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			huggingface: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			"github-models": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
			"together-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
		};

		return formatters[provider] || ((data) => data);
	}

	private static formatOpenAIResponse(data: any): any {
		const message = data.choices?.[0]?.message;
		return { ...data, response: message?.content || "", ...message };
	}

	private static formatOpenRouterResponse(data: any): any {
		const message = data.choices?.[0]?.message;
		const content = message?.content || "";

		return {
			...data,
			response: content,
		};
	}

	private static formatAnthropicResponse(data: any): any {
		if (!data.content) {
			return { ...data, response: "" };
		}

		const response = data.content
			.map((content: { text: string }) => content.text)
			.join(" ");

		return { ...data, response };
	}

	private static formatGoogleStudioResponse(data: any): any {
		const response = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
		return { ...data, response };
	}

	private static formatOllamaResponse(data: any): any {
		return { ...data, response: data.message?.content || "" };
	}

	private static formatWorkersResponse(data: any): any {
		if (data.response) {
			return data;
		}

		return { ...data, response: data.result || "" };
	}

	private static formatBedrockResponse(
		data: any,
		options: ResponseFormatOptions = {},
	): any {
		const type = options.type || ["text"];
		const isImageType =
			type.includes("text-to-image") || type.includes("image-to-image");
		const isVideoType =
			type.includes("text-to-video") || type.includes("image-to-video");

		if (isVideoType) {
			return { ...data, response: data };
		}

		if (isImageType && data.images) {
			return {
				...data,
				response: `Image Generated: [${Math.random().toString(36)}]`,
			};
		}

		if (data.output?.message?.content?.[0]?.text) {
			return { ...data, response: data.output.message.content[0].text };
		}

		return { ...data, response: "No content returned" };
	}
}
