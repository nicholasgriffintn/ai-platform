import type * as webllm from "@mlc-ai/web-llm";

import type { ChatMode, ChatRole, Message } from "~/types";

export class WebLLMService {
	private static instance: WebLLMService;
	private engine: any | null = null;
	private isInitialized = false;
	private chatHistory: any[] = [];
	private currentModel: string | null = null;
	private webllm: typeof import("@mlc-ai/web-llm") | null = null;

	private constructor() {}

	public static getInstance(): WebLLMService {
		if (!WebLLMService.instance) {
			WebLLMService.instance = new WebLLMService();
		}
		return WebLLMService.instance;
	}

	getCurrentModel(): string | null {
		return this.currentModel;
	}

	private async loadWebLLM() {
		if (!this.webllm) {
			this.webllm = await import("@mlc-ai/web-llm");
		}
		return this.webllm;
	}

	async init(
		model: string,
		progressCallback?: (report: any) => void,
	): Promise<void> {
		if (!this.isInitialized || this.currentModel !== model) {
			if (this.engine) {
				await this.unload();
			}
			const webllm = await this.loadWebLLM();
			this.engine = await webllm.CreateMLCEngine(model, {
				initProgressCallback: progressCallback,
			});
			this.isInitialized = true;
			this.currentModel = model;
		}
	}

	async generate(
		selectedChat: string,
		prompt: string,
		onSendMessage: (
			completion_id: string,
			message: string,
			model: string,
			mode: ChatMode,
			role: ChatRole,
		) => Promise<Message[]>,
		onProgress?: (text: string) => void,
	): Promise<string> {
		if (!this.engine || !this.currentModel) {
			throw new Error("Engine or model not initialized");
		}

		await onSendMessage(
			selectedChat,
			prompt,
			this.currentModel,
			"local",
			"user",
		);

		this.chatHistory.push({ role: "user", content: prompt });

		const request: webllm.ChatCompletionRequest = {
			messages: this.chatHistory,
			stream: true,
		};

		let generatedContent = "";
		const asyncChunkGenerator =
			await this.engine.chat.completions.create(request);

		let hasCompleted = false;
		for await (const chunk of asyncChunkGenerator) {
			const delta = chunk.choices[0]?.delta?.content || "";
			if (onProgress && delta) {
				onProgress(delta);
			}
			generatedContent += delta;
			if (chunk.choices[0]?.finish_reason === "stop") {
				hasCompleted = true;
			}
		}

		this.chatHistory.push({
			role: "assistant",
			content: generatedContent,
		});

		if (hasCompleted) {
			await onSendMessage(
				selectedChat,
				generatedContent,
				this.currentModel,
				"local",
				"assistant",
			);
		}

		return generatedContent;
	}

	async resetChat(): Promise<void> {
		if (!this.engine) {
			throw new Error("Engine not initialized");
		}
		await this.engine.resetChat();
		this.chatHistory = [];
	}

	async unload(): Promise<void> {
		if (this.engine) {
			await this.engine.unload();
			this.engine = null;
			this.isInitialized = false;
			this.chatHistory = [];
			this.currentModel = null;
		}
	}
}
