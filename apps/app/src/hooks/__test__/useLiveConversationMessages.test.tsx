import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ConversationModeMetadata } from "@assistant/schemas";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";
import { orderLiveMessages, useLiveConversationMessages } from "../useLiveConversationMessages";

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		generateTitle: vi.fn().mockResolvedValue("Driving Choices"),
		updateConversation: vi.fn().mockResolvedValue({ messages: [] }),
	},
}));

const liveConversationMode = {
	mode: "live",
} as ConversationModeMetadata;

function createMessage(overrides: Partial<Message> & Pick<Message, "content" | "role">): Message {
	const { content, role, ...rest } = overrides;
	return {
		id: crypto.randomUUID(),
		content,
		created: overrides.created ?? Date.now(),
		role,
		timestamp: overrides.timestamp ?? Date.now(),
		...rest,
	};
}

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function wrapperFor(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

describe("useLiveConversationMessages", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiService.generateTitle).mockResolvedValue("Driving Choices");
		vi.mocked(apiService.updateConversation).mockResolvedValue({
			messages: [],
			title: "Driving Choices",
		} as Conversation);
		useChatStore.setState({
			chatMode: "remote",
			chatSettings: {
				...useChatStore.getState().chatSettings,
				localOnly: false,
			},
			currentConversationId: undefined,
			isAuthenticated: true,
			isPro: true,
			localOnlyMode: false,
			model: "gpt-realtime-2",
		});
	});

	it("stores final input transcripts as normal user messages", async () => {
		const queryClient = createQueryClient();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "gpt-realtime-2",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				source: "input",
				text: "Book the train for noon.",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			expect(conversationId).toBeTruthy();
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages).toEqual([
				expect.objectContaining({
					content: "Book the train for noon.",
					role: "user",
				}),
			]);
		});

		const conversationId = useChatStore.getState().currentConversationId;
		expect(apiService.updateConversation).toHaveBeenCalledWith(
			conversationId,
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						content: "Book the train for noon.",
						data: expect.objectContaining({
							conversationMode: liveConversationMode,
							realtime: expect.objectContaining({ source: "input" }),
						}),
						role: "user",
					}),
				],
			}),
		);
	});

	it("deduplicates repeated final input transcripts with the same provider item id", async () => {
		const queryClient = createQueryClient();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "scribe_v2_realtime",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				itemId: "elevenlabs-segment-1",
				source: "input",
				text: "What is the best place in London?",
			});
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				itemId: "elevenlabs-segment-1",
				source: "input",
				text: "What is the best place in London?",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages).toEqual([
				expect.objectContaining({
					content: "What is the best place in London?",
					role: "user",
				}),
			]);
		});
	});

	it("notifies once when a final input transcript is ready for a composed response", async () => {
		const queryClient = createQueryClient();
		const onFinalInputTranscript = vi.fn();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "scribe_v2_realtime",
					onFinalInputTranscript,
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				itemId: "elevenlabs-segment-1",
				source: "input",
				text: "What is the best place in London?",
			});
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				itemId: "elevenlabs-segment-1",
				source: "input",
				text: "What is the best place in London?",
			});
		});

		await waitFor(() => {
			expect(onFinalInputTranscript).toHaveBeenCalledTimes(1);
		});
		expect(onFinalInputTranscript).toHaveBeenCalledWith({
			assistantMessageData: expect.objectContaining({
				data: expect.objectContaining({
					realtime: expect.objectContaining({
						sequence: 1,
						source: "output",
					}),
				}),
				role: "assistant",
			}),
			conversationId: expect.any(String),
			text: "What is the best place in London?",
		});
	});

	it("orders a composed assistant response before the next ElevenLabs user message", () => {
		const firstUserMessage = createMessage({
			content: "First question",
			data: {
				realtime: {
					source: "input",
					sequence: 0,
					turnId: "turn-1",
					turnStartedAt: 1000,
				},
			},
			role: "user",
			timestamp: 1000,
		});
		const composedAssistantMessage = createMessage({
			content: "First answer",
			data: {
				realtime: {
					source: "output",
					sequence: 1,
					turnId: "turn-1",
					turnStartedAt: 1000,
				},
			},
			role: "assistant",
			timestamp: 3000,
		});
		const secondUserMessage = createMessage({
			content: "Second question",
			data: {
				realtime: {
					source: "input",
					sequence: 0,
					turnId: "turn-2",
					turnStartedAt: 2000,
				},
			},
			role: "user",
			timestamp: 2000,
		});

		expect(
			orderLiveMessages([firstUserMessage, secondUserMessage, composedAssistantMessage]).map(
				(message) => [message.role, message.content],
			),
		).toEqual([
			["user", "First question"],
			["assistant", "First answer"],
			["user", "Second question"],
		]);
	});

	it("finalises buffered input text from transcription done events", async () => {
		const queryClient = createQueryClient();
		const onFinalInputTranscript = vi.fn();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "voxtral-mini-transcribe-realtime",
					onFinalInputTranscript,
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				itemId: "mistral-segment-1",
				source: "input",
				text: "Can you hear me?",
			});
			result.current.handleRealtimeEvent({
				itemId: "mistral-segment-1",
				type: "transcription.done",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages).toEqual([
				expect.objectContaining({
					content: "Can you hear me?",
					role: "user",
					status: undefined,
				}),
			]);
			expect(onFinalInputTranscript).toHaveBeenCalledWith({
				assistantMessageData: expect.objectContaining({ role: "assistant" }),
				conversationId,
				text: "Can you hear me?",
			});
		});
	});

	it("does not re-notify composed response after a final segment and transcription done event", async () => {
		const queryClient = createQueryClient();
		const onFinalInputTranscript = vi.fn();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "ink-whisper",
					onFinalInputTranscript,
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				source: "input",
				text: "Tell me the answer.",
			});
			result.current.handleRealtimeEvent({ type: "transcription.done" });
		});

		await waitFor(() => {
			expect(onFinalInputTranscript).toHaveBeenCalledTimes(1);
		});
	});

	it("does not duplicate a Mistral transcript when a stop flush is followed by a final transcript", async () => {
		const queryClient = createQueryClient();
		const onFinalInputTranscript = vi.fn();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "voxtral-mini-transcribe-realtime",
					onFinalInputTranscript,
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "input",
				text: "Who are you?",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages).toEqual([
				expect.objectContaining({
					content: "Who are you?",
					role: "user",
					status: "in_progress",
				}),
			]);
		});

		act(() => {
			result.current.flushLiveMessages();
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				source: "input",
				text: "Who are you?",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages.map((message) => [message.role, message.content])).toEqual([
				["user", "Who are you?"],
			]);
			expect(onFinalInputTranscript).toHaveBeenCalledTimes(1);
			expect(onFinalInputTranscript).toHaveBeenCalledWith({
				assistantMessageData: expect.objectContaining({ role: "assistant" }),
				conversationId,
				text: "Who are you?",
			});
		});
	});

	it("stores Cartesia-style interim transcript text when done has no item id", async () => {
		const queryClient = createQueryClient();
		const onFinalInputTranscript = vi.fn();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "ink-whisper",
					onFinalInputTranscript,
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "input",
				text: "Tell me about this.",
			});
			result.current.handleRealtimeEvent({ type: "transcription.done" });
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages).toEqual([
				expect.objectContaining({
					content: "Tell me about this.",
					role: "user",
					status: undefined,
				}),
			]);
			expect(onFinalInputTranscript).toHaveBeenCalledWith({
				assistantMessageData: expect.objectContaining({ role: "assistant" }),
				conversationId,
				text: "Tell me about this.",
			});
		});
	});

	it("keeps live user messages before assistant messages when metadata is incomplete", () => {
		const assistantMessage = createMessage({
			content: "That's a fun question.",
			data: {
				realtime: {
					source: "output",
					sequence: 1,
					turnId: "turn-1",
					turnStartedAt: 1000,
				},
			},
			role: "assistant",
			timestamp: 1000,
		});
		const userMessage = createMessage({
			content: "Who's the best Christmas person?",
			role: "user",
			timestamp: 1000,
		});

		expect(orderLiveMessages([assistantMessage, userMessage])).toEqual([
			userMessage,
			assistantMessage,
		]);
	});

	it("streams output transcript deltas after a real user message before persisting", async () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"], {
			id: "conversation-1",
			title: "Live",
			isLocalOnly: false,
			messages: [],
		});
		useChatStore.setState({ currentConversationId: "conversation-1" });

		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "gpt-realtime-2",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				source: "input",
				text: "What car would you drive?",
			});
		});

		await waitFor(() => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				"conversation-1",
			]);
			expect(conversation?.messages).toEqual([
				expect.objectContaining({
					content: "What car would you drive?",
					role: "user",
				}),
			]);
		});
		vi.mocked(apiService.updateConversation).mockClear();

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "output",
				text: "Hello",
			});
		});

		await waitFor(() => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				"conversation-1",
			]);
			expect(conversation?.messages[0]).toEqual(
				expect.objectContaining({
					content: "What car would you drive?",
					role: "user",
				}),
			);
			expect(conversation?.messages[1]).toEqual(
				expect.objectContaining({
					content: "Hello",
					role: "assistant",
					status: "in_progress",
				}),
			);
		});
		expect(apiService.updateConversation).not.toHaveBeenCalled();

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "output",
				text: " there",
			});
		});

		await waitFor(() => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				"conversation-1",
			]);
			expect(conversation?.messages[1]?.content).toBe("Hello there");
		});

		act(() => {
			result.current.handleRealtimeEvent({ type: "response.done" });
		});

		await waitFor(() => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				"conversation-1",
			]);
			expect(conversation?.messages[1]?.status).toBeUndefined();
			expect(apiService.updateConversation).toHaveBeenCalledWith(
				"conversation-1",
				expect.objectContaining({
					messages: [
						expect.objectContaining({
							content: "What car would you drive?",
							role: "user",
						}),
						expect.objectContaining({
							content: "Hello there",
							role: "assistant",
						}),
					],
				}),
			);
		});
	});

	it("buffers assistant output until user transcript anchors the visible turn", async () => {
		const queryClient = createQueryClient();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "gpt-realtime-2",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				responseId: "response-1",
				source: "output",
				text: "Small and efficient.",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages ?? []).toEqual([]);
		});
		expect(apiService.updateConversation).not.toHaveBeenCalled();

		act(() => {
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				itemId: "input-1",
				source: "input",
				text: "What car would you drive?",
			});
			result.current.handleRealtimeEvent({ responseId: "response-1", type: "response.done" });
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages).toEqual([
				expect.objectContaining({
					content: "What car would you drive?",
					role: "user",
					status: undefined,
				}),
				expect.objectContaining({
					content: "Small and efficient.",
					role: "assistant",
					status: undefined,
				}),
			]);
			expect(conversation?.title).toBe("Driving Choices");
		});

		expect(apiService.generateTitle).toHaveBeenCalledWith(
			useChatStore.getState().currentConversationId,
			[
				expect.objectContaining({
					content: "What car would you drive?",
					role: "user",
				}),
				expect.objectContaining({
					content: "Small and efficient.",
					role: "assistant",
				}),
			],
		);
	});

	it("keeps overlapping live turns visually ordered by their provider event ids", async () => {
		const queryClient = createQueryClient();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "gpt-realtime-2",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleRealtimeEvent({ type: "input_audio_buffer.speech_started" });
			result.current.handleRealtimeEvent({
				itemId: "input-1",
				type: "input_audio_buffer.committed",
			});
			result.current.handleRealtimeEvent({
				responseId: "response-1",
				type: "response.created",
			});
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				responseId: "response-1",
				source: "output",
				text: "First answer",
			});
			result.current.handleRealtimeEvent({ type: "input_audio_buffer.speech_started" });
			result.current.handleRealtimeEvent({
				itemId: "input-2",
				type: "input_audio_buffer.committed",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages ?? []).toEqual([]);
		});

		act(() => {
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				itemId: "input-1",
				source: "input",
				text: "First question",
			});
			result.current.handleRealtimeEvent({ responseId: "response-1", type: "response.done" });
			result.current.handleTranscript({
				isDelta: false,
				isFinal: true,
				itemId: "input-2",
				source: "input",
				text: "Second question",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages.map((message) => [message.role, message.content])).toEqual([
				["user", "First question"],
				["assistant", "First answer"],
				["user", "Second question"],
			]);
		});
	});

	it("finalises Gemini turns from response completion when input has no final event", async () => {
		const queryClient = createQueryClient();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "gemini-3.1-flash-live-preview",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "input",
				text: "What should I make for dinner?",
			});
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "output",
				text: "Try pasta",
			});
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "output",
				text: " with lemon.",
			});
			result.current.handleRealtimeEvent({ type: "response.done" });
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages.map((message) => [message.role, message.content])).toEqual([
				["user", "What should I make for dinner?"],
				["assistant", "Try pasta with lemon."],
			]);
			expect(conversation?.messages[1]?.status).toBeUndefined();
			expect(conversation?.title).toBe("Driving Choices");
		});

		expect(apiService.generateTitle).toHaveBeenCalled();
	});

	it("starts a new Gemini input message after the previous response completes", async () => {
		const queryClient = createQueryClient();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "gemini-3.1-flash-live-preview",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "input",
				text: "First question",
			});
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "output",
				text: "First answer",
			});
			result.current.handleRealtimeEvent({ type: "response.done" });
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages.map((message) => [message.role, message.content])).toEqual([
				["user", "First question"],
				["assistant", "First answer"],
			]);
		});

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "input",
				text: "Second question",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages.map((message) => [message.role, message.content])).toEqual([
				["user", "First question"],
				["assistant", "First answer"],
				["user", "Second question"],
			]);
		});
	});

	it("finalises partial Gemini output when the response is interrupted", async () => {
		const queryClient = createQueryClient();
		const { result } = renderHook(
			() =>
				useLiveConversationMessages({
					conversationMode: liveConversationMode,
					model: "gemini-3.1-flash-live-preview",
				}),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => {
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "input",
				text: "Tell me a long story",
			});
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "output",
				text: "Once upon",
			});
			result.current.handleRealtimeEvent({ type: "response.interrupted" });
			result.current.handleTranscript({
				isDelta: true,
				isFinal: false,
				source: "input",
				text: "Actually keep it short",
			});
		});

		await waitFor(() => {
			const conversationId = useChatStore.getState().currentConversationId;
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			expect(conversation?.messages.map((message) => [message.role, message.content])).toEqual([
				["user", "Tell me a long story"],
				["assistant", "Once upon"],
				["user", "Actually keep it short"],
			]);
			expect(conversation?.messages[1]?.status).toBeUndefined();
		});
	});
});
