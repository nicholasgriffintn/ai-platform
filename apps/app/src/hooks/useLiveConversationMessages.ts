import type { ConversationModeMetadata } from "@assistant/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { createConversationId } from "~/lib/conversations";
import { normalizeMessage } from "~/lib/messages";
import type { RealtimeTranscriptResult } from "~/lib/realtime/messages";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";
import { useConversationStorage } from "./useConversationStorage";

interface UseLiveConversationMessagesOptions {
	conversationMode?: ConversationModeMetadata;
	model?: string | null;
}

interface ActiveLiveMessage {
	message: Message;
	text: string;
}

interface LiveRealtimeEvent {
	itemId?: string;
	responseId?: string;
	type: string;
}

interface LiveTurn {
	id: string;
	inputFinal: boolean;
	inputStarted: boolean;
	inputTextPresent: boolean;
	outputFinal: boolean;
	outputStarted: boolean;
	startedAt: number;
}

interface LiveMessageOrder {
	sequence: number;
	startedAt: number;
	turnId: string;
}

const DEFAULT_TITLES = new Set(["New Conversation", "New conversation"]);

function resolveRole(source: RealtimeTranscriptResult["source"]): "user" | "assistant" | undefined {
	if (source === "input") {
		return "user";
	}
	if (source === "output") {
		return "assistant";
	}
	return undefined;
}

function appendOrReplaceTranscriptText(
	currentText: string,
	transcript: Pick<RealtimeTranscriptResult, "isDelta" | "text">,
): string {
	if (transcript.isDelta) {
		return `${currentText}${transcript.text}`;
	}

	return transcript.text;
}

function getMessageText(message: Message): string {
	if (typeof message.content === "string") {
		return message.content.trim();
	}

	return message.content
		.map((part) => (part.type === "text" ? part.text || "" : ""))
		.join(" ")
		.trim();
}

function createTemporaryTitle(message: Message): string {
	const text = getMessageText(message);
	if (!text) {
		return "New Conversation";
	}

	return `${text.slice(0, 30)}${text.length > 30 ? "..." : ""}`;
}

function getRecordData(message: Message): Record<string, unknown> {
	if (!message.data || typeof message.data !== "object") {
		return {};
	}

	return Object.fromEntries(Object.entries(message.data));
}

function getLiveMessageOrder(message: Message): LiveMessageOrder | undefined {
	const realtime = getRecordData(message).realtime;
	if (!realtime || typeof realtime !== "object") {
		return undefined;
	}

	const metadata = realtime as Record<string, unknown>;
	if (typeof metadata.turnId !== "string" || typeof metadata.sequence !== "number") {
		return undefined;
	}

	return {
		sequence: metadata.sequence,
		startedAt: typeof metadata.turnStartedAt === "number" ? metadata.turnStartedAt : 0,
		turnId: metadata.turnId,
	};
}

function orderLiveMessages(messages: Message[]): Message[] {
	const originalIndex = new Map(messages.map((message, index) => [message.id, index]));

	return [...messages].sort((left, right) => {
		const leftOrder = getLiveMessageOrder(left);
		const rightOrder = getLiveMessageOrder(right);

		if (leftOrder && rightOrder) {
			if (leftOrder.startedAt !== rightOrder.startedAt) {
				return leftOrder.startedAt - rightOrder.startedAt;
			}
			if (leftOrder.turnId === rightOrder.turnId) {
				return leftOrder.sequence - rightOrder.sequence;
			}
		}

		return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
	});
}

function isDefaultTitle(title?: string): boolean {
	return !title || DEFAULT_TITLES.has(title);
}

export function useLiveConversationMessages({
	conversationMode,
	model,
}: UseLiveConversationMessagesOptions = {}) {
	const queryClient = useQueryClient();
	const currentConversationId = useChatStore((state) => state.currentConversationId);
	const startNewConversation = useChatStore((state) => state.startNewConversation);
	const { determineStorageMode, updateConversation } = useConversationStorage();

	const currentConversationIdRef = useRef(currentConversationId);
	const currentInputTurnRef = useRef<LiveTurn | null>(null);
	const currentOutputTurnRef = useRef<LiveTurn | null>(null);
	const inputMessageByTurnRef = useRef(new Map<string, ActiveLiveMessage>());
	const inputTurnByItemIdRef = useRef(new Map<string, LiveTurn>());
	const liveCreatedConversationIdRef = useRef<string | null>(null);
	const outputMessageByTurnRef = useRef(new Map<string, ActiveLiveMessage>());
	const outputTurnByItemIdRef = useRef(new Map<string, LiveTurn>());
	const outputTurnByResponseIdRef = useRef(new Map<string, LiveTurn>());
	const queueRef = useRef<Promise<void>>(Promise.resolve());
	const titleGenerationRef = useRef<Promise<void> | null>(null);
	const titledConversationIdRef = useRef<string | null>(null);
	const turnsRef = useRef<LiveTurn[]>([]);

	useEffect(() => {
		currentConversationIdRef.current = currentConversationId;
	}, [currentConversationId]);

	const ensureConversationId = useCallback(() => {
		if (currentConversationIdRef.current) {
			return currentConversationIdRef.current;
		}

		const conversationId = createConversationId();
		currentConversationIdRef.current = conversationId;
		liveCreatedConversationIdRef.current = conversationId;
		startNewConversation(conversationId);
		return conversationId;
	}, [startNewConversation]);

	const createTurn = useCallback(() => {
		const turn: LiveTurn = {
			id: crypto.randomUUID(),
			inputFinal: false,
			inputStarted: false,
			inputTextPresent: false,
			outputFinal: false,
			outputStarted: false,
			startedAt: Date.now(),
		};
		turnsRef.current = [...turnsRef.current, turn];
		return turn;
	}, []);

	const beginInputTurn = useCallback(() => {
		const turn = createTurn();
		turn.inputStarted = true;
		currentInputTurnRef.current = turn;
		return turn;
	}, [createTurn]);

	const bindInputTurn = useCallback((turn: LiveTurn, itemId?: string) => {
		if (itemId) {
			inputTurnByItemIdRef.current.set(itemId, turn);
		}
	}, []);

	const bindOutputTurn = useCallback(
		(turn: LiveTurn, identifiers: Pick<LiveRealtimeEvent, "itemId" | "responseId">) => {
			if (identifiers.itemId) {
				outputTurnByItemIdRef.current.set(identifiers.itemId, turn);
			}
			if (identifiers.responseId) {
				outputTurnByResponseIdRef.current.set(identifiers.responseId, turn);
			}
		},
		[],
	);

	const resolveInputTurn = useCallback(
		(transcript: Pick<RealtimeTranscriptResult, "itemId">) => {
			if (transcript.itemId) {
				const mappedTurn = inputTurnByItemIdRef.current.get(transcript.itemId);
				if (mappedTurn) {
					return mappedTurn;
				}
			}

			const currentTurn = currentInputTurnRef.current;
			const turn =
				currentTurn && !currentTurn.inputFinal
					? currentTurn
					: (turnsRef.current.find((candidate) => !candidate.inputTextPresent) ?? beginInputTurn());
			bindInputTurn(turn, transcript.itemId);
			return turn;
		},
		[beginInputTurn, bindInputTurn],
	);

	const resolveOutputTurn = useCallback(
		(identifiers: Pick<RealtimeTranscriptResult, "itemId" | "responseId"> = {}) => {
			const mappedTurn =
				(identifiers.responseId
					? outputTurnByResponseIdRef.current.get(identifiers.responseId)
					: undefined) ??
				(identifiers.itemId ? outputTurnByItemIdRef.current.get(identifiers.itemId) : undefined);
			if (mappedTurn) {
				return mappedTurn;
			}

			const currentOutputTurn = currentOutputTurnRef.current;
			const turn =
				currentOutputTurn && !currentOutputTurn.outputFinal
					? currentOutputTurn
					: (turnsRef.current.find((candidate) => !candidate.outputStarted) ?? createTurn());

			turn.outputStarted = true;
			currentOutputTurnRef.current = turn;
			bindOutputTurn(turn, identifiers);
			return turn;
		},
		[bindOutputTurn, createTurn],
	);

	const removeTurn = useCallback((turn: LiveTurn) => {
		turnsRef.current = turnsRef.current.filter((candidate) => candidate.id !== turn.id);
		inputMessageByTurnRef.current.delete(turn.id);
		outputMessageByTurnRef.current.delete(turn.id);
		if (currentInputTurnRef.current?.id === turn.id) {
			currentInputTurnRef.current = null;
		}
		if (currentOutputTurnRef.current?.id === turn.id) {
			currentOutputTurnRef.current = null;
		}
		for (const [itemId, mappedTurn] of inputTurnByItemIdRef.current) {
			if (mappedTurn.id === turn.id) {
				inputTurnByItemIdRef.current.delete(itemId);
			}
		}
		for (const [itemId, mappedTurn] of outputTurnByItemIdRef.current) {
			if (mappedTurn.id === turn.id) {
				outputTurnByItemIdRef.current.delete(itemId);
			}
		}
		for (const [responseId, mappedTurn] of outputTurnByResponseIdRef.current) {
			if (mappedTurn.id === turn.id) {
				outputTurnByResponseIdRef.current.delete(responseId);
			}
		}
	}, []);

	const buildLiveMessage = useCallback(
		({
			activeMessage,
			content,
			isFinal,
			role,
			source,
			turn,
		}: {
			activeMessage?: ActiveLiveMessage | null;
			content: string;
			isFinal: boolean;
			role: "user" | "assistant";
			source: RealtimeTranscriptResult["source"];
			turn: LiveTurn;
		}) => {
			const now = Date.now();
			const existingData = activeMessage ? getRecordData(activeMessage.message) : {};

			return normalizeMessage({
				...activeMessage?.message,
				content,
				created: activeMessage?.message.created ?? now,
				data: {
					...existingData,
					...(conversationMode ? { conversationMode } : {}),
					realtime: {
						source,
						turnId: turn.id,
						turnStartedAt: turn.startedAt,
						sequence: role === "user" ? 0 : 1,
					},
				},
				id: activeMessage?.message.id ?? crypto.randomUUID(),
				model: activeMessage?.message.model || model || undefined,
				role,
				status: isFinal ? undefined : "in_progress",
				timestamp: activeMessage?.message.timestamp ?? now,
			});
		},
		[conversationMode, model],
	);

	const upsertLiveMessage = useCallback(
		async (conversationId: string, message: Message) => {
			const { shouldSyncRemote } = determineStorageMode();

			await updateConversation(conversationId, (previous) => {
				const now = new Date().toISOString();
				const existingMessages = previous?.messages ?? [];
				const existingIndex = existingMessages.findIndex(
					(existingMessage) => existingMessage.id === message.id,
				);
				const messages =
					existingIndex === -1
						? [...existingMessages, message]
						: existingMessages.map((existingMessage, index) =>
								index === existingIndex ? message : existingMessage,
							);

				return {
					...(previous ?? {
						id: conversationId,
						created_at: now,
						isLocalOnly: !shouldSyncRemote,
						title: "New Conversation",
					}),
					messages: orderLiveMessages(messages),
				};
			});
		},
		[determineStorageMode, updateConversation],
	);

	const flushBufferedOutput = useCallback(
		async (conversationId: string, turn: LiveTurn) => {
			if (!turn.inputTextPresent) {
				return;
			}

			const outputMessage = outputMessageByTurnRef.current.get(turn.id);
			if (!outputMessage?.text.trim()) {
				return;
			}

			await upsertLiveMessage(conversationId, outputMessage.message);
		},
		[upsertLiveMessage],
	);

	const persistConversation = useCallback(
		async (conversationId: string) => {
			if (!determineStorageMode().shouldSyncRemote) {
				return;
			}

			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			if (!conversation?.messages.length) {
				return;
			}

			await apiService.updateConversation(conversationId, {
				messages: conversation.messages,
			});
		},
		[determineStorageMode, queryClient],
	);

	const updateTemporaryTitle = useCallback(
		async (conversationId: string) => {
			if (liveCreatedConversationIdRef.current !== conversationId) {
				return;
			}

			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			if (!conversation || !isDefaultTitle(conversation.title)) {
				return;
			}

			const firstUserMessage = conversation.messages.find(
				(message) => message.role === "user" && getMessageText(message),
			);
			if (!firstUserMessage) {
				return;
			}

			await updateConversation(conversationId, (previous) => ({
				...previous!,
				title: createTemporaryTitle(firstUserMessage),
			}));
		},
		[queryClient, updateConversation],
	);

	const generateLiveTitle = useCallback(
		async (conversationId: string) => {
			if (
				liveCreatedConversationIdRef.current !== conversationId ||
				titleGenerationRef.current ||
				titledConversationIdRef.current === conversationId
			) {
				return;
			}

			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			if (!conversation?.messages.length) {
				return;
			}

			const firstUserMessage = conversation.messages.find(
				(message) => message.role === "user" && getMessageText(message),
			);
			const firstAssistantMessage = conversation.messages.find(
				(message) =>
					message.role === "assistant" &&
					message.status !== "in_progress" &&
					getMessageText(message),
			);
			if (!firstUserMessage || !firstAssistantMessage) {
				return;
			}

			titleGenerationRef.current = (async () => {
				let title = createTemporaryTitle(firstUserMessage);

				try {
					title = await apiService.generateTitle(conversationId, [
						firstUserMessage,
						firstAssistantMessage,
					]);
				} catch (error) {
					console.error("Failed to generate live conversation title:", error);
				}

				await updateConversation(conversationId, (previous) => ({
					...previous!,
					title,
				}));
				titledConversationIdRef.current = conversationId;
			})().finally(() => {
				titleGenerationRef.current = null;
			});

			await titleGenerationRef.current;
		},
		[queryClient, updateConversation],
	);

	const maybePersistTurn = useCallback(
		async (conversationId: string, turn: LiveTurn) => {
			if (turn.inputFinal) {
				await flushBufferedOutput(conversationId, turn);
				await persistConversation(conversationId);
				await updateTemporaryTitle(conversationId);
			}

			if (!turn.inputFinal || !turn.outputFinal) {
				return;
			}

			await persistConversation(conversationId);
			await generateLiveTitle(conversationId);
			removeTurn(turn);
		},
		[flushBufferedOutput, generateLiveTitle, persistConversation, removeTurn, updateTemporaryTitle],
	);

	const enqueue = useCallback((operation: () => Promise<void>) => {
		queueRef.current = queueRef.current.then(operation, operation).catch((error) => {
			console.error("Failed to update live conversation messages:", error);
		});
		return queueRef.current;
	}, []);

	const handleTranscript = useCallback(
		(transcript: RealtimeTranscriptResult) => {
			const role = resolveRole(transcript.source);
			const transcriptText = transcript.text.trim();
			if (!role || !transcriptText) {
				return;
			}

			void enqueue(async () => {
				const conversationId = ensureConversationId();
				const turn =
					role === "user"
						? resolveInputTurn(transcript)
						: resolveOutputTurn({
								itemId: transcript.itemId,
								responseId: transcript.responseId,
							});
				const activeMessages =
					role === "user" ? inputMessageByTurnRef.current : outputMessageByTurnRef.current;
				const activeMessage = activeMessages.get(turn.id);
				const nextText = appendOrReplaceTranscriptText(activeMessage?.text ?? "", transcript);
				const message = buildLiveMessage({
					activeMessage,
					content: nextText,
					isFinal: transcript.isFinal,
					role,
					source: transcript.source,
					turn,
				});

				if (transcript.isFinal) {
					if (role === "user") {
						turn.inputFinal = true;
					} else {
						turn.outputFinal = true;
					}
					activeMessages.set(turn.id, { message, text: nextText });
				} else {
					activeMessages.set(turn.id, { message, text: nextText });
				}

				if (role === "user") {
					turn.inputTextPresent = true;
					await upsertLiveMessage(conversationId, message);
					await flushBufferedOutput(conversationId, turn);
				} else if (turn.inputTextPresent) {
					await upsertLiveMessage(conversationId, message);
				}
				if (transcript.isFinal) {
					await maybePersistTurn(conversationId, turn);
				}
			});
		},
		[
			buildLiveMessage,
			enqueue,
			ensureConversationId,
			flushBufferedOutput,
			maybePersistTurn,
			resolveInputTurn,
			resolveOutputTurn,
			upsertLiveMessage,
		],
	);

	const handleRealtimeEvent = useCallback(
		(event: LiveRealtimeEvent) => {
			if (event.type === "input_audio_buffer.speech_started") {
				void enqueue(async () => {
					beginInputTurn();
				});
				return;
			}

			if (event.type === "input_audio_buffer.committed") {
				void enqueue(async () => {
					const turn = currentInputTurnRef.current ?? beginInputTurn();
					turn.inputStarted = true;
					bindInputTurn(turn, event.itemId);
				});
				return;
			}

			if (event.type === "response.created") {
				void enqueue(async () => {
					const turn =
						currentInputTurnRef.current && !currentInputTurnRef.current.outputStarted
							? currentInputTurnRef.current
							: (turnsRef.current.find((candidate) => !candidate.outputStarted) ??
								beginInputTurn());
					turn.outputStarted = true;
					currentOutputTurnRef.current = turn;
					bindOutputTurn(turn, event);
				});
				return;
			}

			if (event.type === "response.output_item.added") {
				void enqueue(async () => {
					const turn = resolveOutputTurn(event);
					bindOutputTurn(turn, event);
				});
				return;
			}

			if (event.type !== "response.done") {
				return;
			}

			void enqueue(async () => {
				const conversationId = currentConversationIdRef.current;
				const turn =
					(event.responseId
						? outputTurnByResponseIdRef.current.get(event.responseId)
						: undefined) ?? currentOutputTurnRef.current;
				const outputMessage = turn ? outputMessageByTurnRef.current.get(turn.id) : undefined;
				if (!conversationId || !turn || !outputMessage?.text.trim()) {
					return;
				}

				const message = buildLiveMessage({
					activeMessage: outputMessage,
					content: outputMessage.text,
					isFinal: true,
					role: "assistant",
					source: "output",
					turn,
				});
				outputMessageByTurnRef.current.set(turn.id, { message, text: outputMessage.text });
				turn.outputFinal = true;

				if (turn.inputTextPresent) {
					await upsertLiveMessage(conversationId, message);
				}
				await maybePersistTurn(conversationId, turn);
			});
		},
		[
			beginInputTurn,
			bindInputTurn,
			bindOutputTurn,
			buildLiveMessage,
			enqueue,
			maybePersistTurn,
			resolveOutputTurn,
			upsertLiveMessage,
		],
	);

	const flushLiveMessages = useCallback(() => {
		void enqueue(async () => {
			const conversationId = currentConversationIdRef.current;
			if (!conversationId) {
				return;
			}

			const turnsToFlush = turnsRef.current.slice();
			for (const turn of turnsToFlush) {
				for (const [role, activeMessages] of [
					["user", inputMessageByTurnRef.current] as const,
					["assistant", outputMessageByTurnRef.current] as const,
				]) {
					const activeMessage = activeMessages.get(turn.id);
					if (!activeMessage?.text.trim()) {
						continue;
					}

					const message = buildLiveMessage({
						activeMessage,
						content: activeMessage.text,
						isFinal: true,
						role,
						source: role === "user" ? "input" : "output",
						turn,
					});
					activeMessages.set(turn.id, { message, text: activeMessage.text });
					if (role === "user") {
						turn.inputFinal = true;
						turn.inputTextPresent = true;
						await upsertLiveMessage(conversationId, message);
					} else {
						turn.outputFinal = true;
						if (turn.inputTextPresent) {
							await upsertLiveMessage(conversationId, message);
						}
					}
				}

				await maybePersistTurn(conversationId, turn);
			}
		});
	}, [buildLiveMessage, enqueue, maybePersistTurn, upsertLiveMessage]);

	return {
		flushLiveMessages,
		handleRealtimeEvent,
		handleTranscript,
	};
}
