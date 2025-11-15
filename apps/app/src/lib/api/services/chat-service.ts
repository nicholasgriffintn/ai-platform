import type { ChatMode, ChatSettings, Conversation, Message } from "~/types";
import { normalizeMessage } from "../../messages";
import { fetchApi, returnFetchedData } from "../fetch-wrapper";

export class ChatService {
	constructor(private getHeaders: () => Promise<Record<string, string>>) {}

	async listChats(): Promise<Conversation[]> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error listing chats:", error);
		}

		try {
			const response = await fetchApi("/chat/completions", {
				method: "GET",
				headers,
			});

			if (!response.ok) {
				throw new Error(`Failed to list chats: ${response.statusText}`);
			}

			const data = await returnFetchedData<{
				conversations: {
					id: string;
					title: string;
					messages: string[];
					last_message_at: string;
					parent_conversation_id?: string;
					parent_message_id?: string;
				}[];
			}>(response);

			if (!data.conversations || !Array.isArray(data.conversations)) {
				console.error(
					"Unexpected response format from /chat/completions endpoint:",
					data,
				);
				return [];
			}

			const results = data.conversations.map((conversation) => ({
				...conversation,
				messages: [],
				message_ids: conversation.messages,
				parent_conversation_id: conversation.parent_conversation_id,
				parent_message_id: conversation.parent_message_id,
			}));

			return results.sort((a, b) => {
				const aTimestamp = new Date(a.last_message_at).getTime();
				const bTimestamp = new Date(b.last_message_at).getTime();
				return bTimestamp - aTimestamp;
			});
		} catch (error) {
			console.error("Error listing chats:", error);
			return [];
		}
	}

	async getChat(
		completion_id: string,
		options?: { refreshPending?: boolean },
	): Promise<Conversation> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting chat:", error);
		}

		const refreshPending = options?.refreshPending ?? true;
		const url = refreshPending
			? `/chat/completions/${completion_id}?refresh_pending=true`
			: `/chat/completions/${completion_id}`;

		const response = await fetchApi(url, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to get chat: ${response.statusText}`);
		}

		const conversation = await returnFetchedData<any>(response);

		if (!conversation.id) {
			return {
				id: completion_id,
				title: "New conversation",
				messages: [],
			};
		}

		const messages = conversation.messages;

		const transformedMessages = messages.map((msg: any) =>
			normalizeMessage(msg),
		);

		return {
			id: completion_id,
			title: conversation.title,
			messages: transformedMessages,
			is_public: conversation.is_public,
			share_id: conversation.share_id,
			parent_conversation_id: conversation.parent_conversation_id,
			parent_message_id: conversation.parent_message_id,
		};
	}

	async generateTitle(
		completion_id: string,
		messages: Message[],
	): Promise<string> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error generating title:", error);
		}

		const formattedMessages = messages.map((msg) => ({
			id: msg.id,
			role: msg.role,
			content: msg.content,
			data: msg.data,
			name: msg.name,
			tool_calls: msg.tool_calls,
		}));

		const response = await fetchApi(
			`/chat/completions/${completion_id}/generate-title`,
			{
				method: "POST",
				headers,
				body: {
					completion_id,
					messages: formattedMessages,
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to generate title: ${response.statusText}`);
		}

		const data = await returnFetchedData<any>(response);
		return data.title;
	}

	async updateConversationTitle(
		completion_id: string,
		newTitle: string,
	): Promise<void> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error updating conversation title:", error);
		}

		const updateResponse = await fetchApi(
			`/chat/completions/${completion_id}`,
			{
				method: "PUT",
				headers,
				body: {
					completion_id,
					title: newTitle,
				},
			},
		);

		if (!updateResponse.ok) {
			throw new Error(
				`Failed to update chat title: ${updateResponse.statusText}`,
			);
		}
	}

	async deleteConversation(completion_id: string): Promise<void> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error deleting conversation:", error);
		}

		const response = await fetchApi(`/chat/completions/${completion_id}`, {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to delete chat: ${response.statusText}`);
		}
	}

	async deleteAllConversations(): Promise<void> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error deleting all conversations:", error);
		}

		const response = await fetchApi("/chat/completions", {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(
				`Failed to delete all conversations: ${response.statusText}`,
			);
		}
	}

	async shareConversation(
		completion_id: string,
	): Promise<{ share_id: string }> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error sharing conversation:", error);
		}

		const response = await fetchApi(
			`/chat/completions/${completion_id}/share`,
			{
				method: "POST",
				headers,
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to share conversation: ${response.statusText}`);
		}

		return await returnFetchedData<{ share_id: string }>(response);
	}

	async unshareConversation(completion_id: string): Promise<void> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error unsharing conversation:", error);
		}

		const response = await fetchApi(
			`/chat/completions/${completion_id}/share`,
			{
				method: "DELETE",
				headers,
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to unshare conversation: ${response.statusText}`);
		}
	}

	async submitFeedback(
		completion_id: string,
		log_id: string,
		feedback: 1 | -1,
		score = 50,
	): Promise<void> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error submitting feedback:", error);
		}

		const response = await fetchApi(
			`/chat/completions/${completion_id}/feedback`,
			{
				method: "POST",
				headers,
				body: {
					log_id,
					feedback,
					score,
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to submit feedback: ${response.statusText}`);
		}
	}

	async streamChatCompletions(
		completion_id: string,
		messages: Message[],
		model: string | undefined,
		mode: ChatMode,
		chatSettings: ChatSettings,
		signal: AbortSignal,
		onProgress: (
			text: string,
			reasoning?: string,
			toolResponses?: Message[],
			done?: boolean,
		) => void,
		onStateChange: (state: string, data?: any) => void,
		store = true,
		streamingEnabled = true,
		use_multi_model = false,
		endpoint = "/chat/completions",
		selectedTools?: string[],
	): Promise<Message> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error streaming chat completions:", error);
		}

		const formattedMessages = messages.map((msg) => {
			if (Array.isArray(msg.content)) {
				return {
					id: msg.id || undefined,
					role: msg.role,
					content: msg.content,
					data: msg.data || undefined,
					name: msg.name || undefined,
				};
			}

			return {
				id: msg.id || undefined,
				role: msg.role,
				content:
					typeof msg.content === "string"
						? msg.content
						: JSON.stringify(msg.content),
				data: msg.data || undefined,
				name: msg.name || undefined,
			};
		});

		const requestBody: Record<string, any> = {
			...chatSettings,
			completion_id,
			mode,
			messages: formattedMessages,
			platform: "web",
			store,
			stream: streamingEnabled,
			enabled_tools: selectedTools,
			use_multi_model,
		};

		if (model !== undefined) {
			requestBody.model = model;
		}

		const response = await fetchApi(endpoint, {
			method: "POST",
			headers,
			body: requestBody,
			signal,
		});

		if (!response.ok) {
			throw new Error(
				`Failed to stream chat completions: ${response.statusText}`,
			);
		}

		return this.processStreamingResponse(
			response,
			model,
			onProgress,
			onStateChange,
		);
	}

	private async processStreamingResponse(
		response: Response,
		model: string | undefined,
		onProgress: (
			text: string,
			reasoning?: string,
			toolResponses?: Message[],
			done?: boolean,
		) => void,
		onStateChange: (state: string, data?: any) => void,
	): Promise<Message> {
		const decoder = new TextDecoder();
		let buffer = "";

		let content = "";
		let messageData = null;
		let reasoning = "";
		let thinking = "";
		let citations = null;
		let usage = null;
		let id = null;
		let created = null;
		let logId = null;
		const toolCalls: any[] = [];
		const pendingToolCalls: Record<string, any> = {};
		const toolResponses: Message[] = [];

		let responseModel = model;

		const isStreamingResponse = response.headers
			.get("content-type")
			?.includes("text/event-stream");

		if (!isStreamingResponse) {
			const data = await returnFetchedData<any>(response);

			if (data.error) {
				throw new Error(data.error.message || "Unknown error");
			}

			usage = data.usage || null;
			id = data.id || crypto.randomUUID();
			created = data.created || Date.now();
			logId = data.log_id || null;
			content = data.choices?.[0]?.message?.content || "";
			messageData = data.choices?.[0]?.message?.data || null;
			reasoning = data.choices?.[0]?.message?.reasoning || "";
			toolCalls.push(...(data.choices?.[0]?.message?.tool_calls || []));
			citations = data.choices?.[0]?.message?.citations || null;
		} else {
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("Response body is not readable as a stream");
			}

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}

					const chunk = decoder.decode(value, { stream: true });
					buffer += chunk;

					const lines = buffer.split("\n\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						if (!line) continue;
						if (typeof line !== "string" || !line.trim()) continue;

						if (line.startsWith("data: ")) {
							const data = line.substring(6);

							if (data === "[DONE]") {
								onProgress(content, reasoning, undefined, true);
								continue;
							}

							try {
								const parsedData = JSON.parse(data);

								if (parsedData.type === "content_block_delta") {
									content += parsedData.content;
									onProgress(content, reasoning, undefined, false);
								} else if (parsedData.choices?.[0]?.delta?.content) {
									content += parsedData.choices[0].delta.content;
									onProgress(content, reasoning, undefined, false);
								} else if (parsedData.type === "message_stop") {
									onProgress(content, reasoning, undefined, true);
								} else if (parsedData.type === "state") {
									onStateChange(parsedData.state, parsedData);
								} else if (parsedData.type === "thinking_delta") {
									thinking += parsedData.thinking || "";
									onProgress(content, thinking, undefined, false);
								} else if (parsedData.type === "tool_use_start") {
									pendingToolCalls[parsedData.tool_id] = {
										id: parsedData.tool_id,
										name: parsedData.tool_name,
										parameters: {},
									};
									onStateChange("tool_use_start", parsedData);
								} else if (parsedData.type === "tool_use_delta") {
									if (pendingToolCalls[parsedData.tool_id]) {
										pendingToolCalls[parsedData.tool_id].parameters = {
											...pendingToolCalls[parsedData.tool_id].parameters,
											...parsedData.parameters,
										};
									}
								} else if (parsedData.type === "tool_use_stop") {
									if (pendingToolCalls[parsedData.tool_id]) {
										toolCalls.push(pendingToolCalls[parsedData.tool_id]);
										delete pendingToolCalls[parsedData.tool_id];
									}
									onStateChange("tool_use_stop", parsedData);
								} else if (parsedData.type === "tool_response") {
									if (toolResponses.find((tool) => tool.id === parsedData.id)) {
										continue;
									}

									const toolResult = parsedData.result;
									const toolResponseData = toolResult.data || null;

									const toolResponse = normalizeMessage({
										role: toolResult.role || "tool",
										id: toolResult.id || crypto.randomUUID(),
										content: toolResult.content || "",
										name: toolResult.name,
										status: toolResult.status || null,
										data: toolResponseData,
										created: Date.now(),
										timestamp: toolResult.timestamp,
										log_id: toolResult.log_id,
										model: toolResult.model,
										platform: toolResult.platform,
										tool_calls: toolResult.tool_calls,
									});

									toolResponses.push(toolResponse);
									onProgress("", "", [toolResponse]);
								} else if (parsedData.type === "message_delta") {
									if (parsedData.usage) {
										usage = parsedData.usage;
									}
									if (parsedData.log_id) {
										logId = parsedData.log_id;
									}
									if (parsedData.citations) {
										citations = parsedData.citations;
									}
									if (parsedData.model) {
										responseModel = parsedData.model;
									}
								}
							} catch (e) {
								console.error("Error parsing SSE data:", e, data);
							}
						}
					}
				}
			} catch (error) {
				console.error("Error reading stream:", error);
				if (error instanceof Error && error.name !== "AbortError") {
					throw error;
				}
			} finally {
				reader.releaseLock();
			}
		}

		if (thinking) {
			reasoning = thinking;
		}

		return normalizeMessage({
			role: "assistant",
			content,
			data: messageData,
			reasoning: reasoning
				? {
						collapsed: false,
						content: reasoning,
					}
				: undefined,
			id: id,
			created: created,
			model: responseModel,
			citations: citations || null,
			usage: usage,
			tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
			log_id: logId,
		});
	}
}
