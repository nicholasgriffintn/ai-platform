import { GitBranch, Loader2, MessagesSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { VList, type VListHandle } from "virtua";

import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import { useCanAccessProFeatures } from "~/hooks/useCanAccessProFeatures";
import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { buildAgentTraceEntries } from "~/lib/agent-trace";
import {
	canOfferOpinionRequestForMessage,
	shouldPromoteOpinionRequest,
	type OpinionRequest,
} from "~/lib/chat/opinion";
import { createModelReferenceMap, getAvailableModels, getModelByReference } from "~/lib/models";
import {
	useIsLoading,
	useLoadingMessage,
	useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { Message } from "~/types";
import type { ArtifactProps } from "~/types/artifact";
import { AgentTraceButton } from "./AgentTracePanel";
import { ChatMessage } from "./ChatMessage";
import { getMessageListScrollKey } from "./messageListScroll";
import { MessageSkeleton } from "./MessageSkeleton";
import { ScrollButton } from "./ScrollButton";
import { ShareButton } from "./ShareButton";

interface MessageListProps {
	onToolInteraction?: (toolName: string, action: "useAsPrompt", data: Record<string, any>) => void;
	onArtifactOpen?: (
		artifact: ArtifactProps,
		combine?: boolean,
		artifacts?: ArtifactProps[],
	) => void;
	messages?: Message[];
	isSharedView?: boolean;
	onBranch?: (messageId: string, modelId?: string) => void;
	isBranching?: boolean;
	onRequestOpinion?: (messageId: string, request: OpinionRequest) => void;
	isRequestingOpinion?: boolean;
}

export const MessageList = ({
	onToolInteraction,
	onArtifactOpen,
	messages: propMessages,
	isSharedView = false,
	onBranch,
	isBranching = false,
	onRequestOpinion,
	isRequestingOpinion = false,
}: MessageListProps) => {
	const { currentConversationId, isAuthenticated, setCurrentConversationId } = useChatStore();

	const { data: conversation, isLoading: isLoadingConversation } = useChat(
		!isSharedView ? currentConversationId : undefined,
	);
	const { data: apiModels = {} } = useModels();
	const webLLMModels = useWebLLMModels();
	const canAccessProFeatures = useCanAccessProFeatures();

	const {
		streamStarted,
		retryMessage,
		updateUserMessage,
		editingMessageId,
		startEditingMessage,
		stopEditingMessage,
	} = useChatManager();

	const messages = propMessages || conversation?.messages || [];
	const traceEntries = useMemo(() => buildAgentTraceEntries(messages), [messages]);
	const availableModels = useMemo(
		() => getAvailableModels(apiModels, true, webLLMModels),
		[apiModels, webLLMModels],
	);
	const modelReferences = useMemo(
		() => createModelReferenceMap(availableModels),
		[availableModels],
	);
	const opinionAvailability = useMemo(() => {
		const availability = new Map<
			string,
			{
				canRequest: boolean;
				shouldPromote: boolean;
			}
		>();

		for (const message of messages) {
			const canRequest = canOfferOpinionRequestForMessage(
				messages,
				message.id,
				canAccessProFeatures,
			);
			availability.set(message.id, {
				canRequest,
				shouldPromote: canRequest && shouldPromoteOpinionRequest(messages, message.id),
			});
		}

		return availability;
	}, [canAccessProFeatures, messages]);
	const lastMessageScrollKey = useMemo(
		() => getMessageListScrollKey({ conversationId: currentConversationId, messages }),
		[currentConversationId, messages],
	);

	const isStreamLoading = useIsLoading("stream-response");
	const isModelInitializing = useIsLoading("model-init");

	const streamLoadingMessage = useLoadingMessage("stream-response") || "Generating response...";
	const modelInitMessage = useLoadingMessage("model-init") || "Initializing model...";
	const modelInitProgress = useLoadingProgress("model-init") || 0;

	const virtualRef = useRef<VListHandle>(null);
	const prevCount = useRef(0);
	const isNearBottomRef = useRef(true);

	// scroll-to-bottom on mount and when new messages arrive, except in shared view
	useEffect(() => {
		if (isSharedView) {
			prevCount.current = messages.length;
			return;
		}
		const lastIndex = messages.length - 1;
		const shouldFollowNewMessages = prevCount.current === 0 || isNearBottomRef.current;
		if (virtualRef.current && shouldFollowNewMessages) {
			virtualRef.current.scrollToIndex(lastIndex, { align: "end" });
			isNearBottomRef.current = true;
		}
		prevCount.current = messages.length;
	}, [lastMessageScrollKey, messages.length, isSharedView]);

	// show/hide the "scroll to bottom" button when user scrolls up
	const [showScroll, setShowScroll] = useState(false);
	const handleScroll = () => {
		const v = virtualRef.current;
		if (!v) {
			setShowScroll(false);
			return;
		}
		const { scrollSize, scrollOffset, viewportSize } = v;
		const distance = scrollSize - (scrollOffset + viewportSize);
		isNearBottomRef.current = distance <= 100;
		setShowScroll(distance > 100);
	};

	return (
		<div
			className="flex flex-col flex-1 relative"
			data-conversation-id={currentConversationId || undefined}
			role="log"
			aria-live="polite"
			aria-label="Conversation messages"
			aria-atomic="false"
		>
			<VList
				ref={virtualRef}
				className="flex-1 pt-4 pr-2 h-full overflow-auto w-full"
				onScroll={handleScroll}
			>
				{!isSharedView && (
					<div className="mb-3">
						<div className="flex items-center">
							<h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 min-w-0 truncate flex-grow">
								{conversation?.parent_conversation_id && (
									<GitBranch
										size={16}
										className="flex-shrink-0 text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
										aria-label="Go to original conversation"
										onClick={() => setCurrentConversationId(conversation.parent_conversation_id!)}
									/>
								)}
								<MessagesSquare size={16} className="flex-shrink-0" />
								<span className="truncate">{conversation?.title || "New conversation"}</span>
							</h2>
							<div className="flex flex-shrink-0 items-center gap-1">
								<AgentTraceButton entries={traceEntries} />
								{!conversation?.isLocalOnly &&
									!isLoadingConversation &&
									currentConversationId &&
									isAuthenticated && (
										<ShareButton
											conversationId={currentConversationId}
											isPublic={conversation?.is_public}
											shareId={conversation?.share_id}
											className="flex-shrink-0"
										/>
									)}
							</div>
						</div>
					</div>
				)}
				{!isSharedView && isLoadingConversation ? (
					<div className="py-4 space-y-4">
						{[...Array(3)].map((_, i) => (
							<MessageSkeleton key={`skeleton-item-${i}`} />
						))}
					</div>
				) : (
					<>
						{messages.map((message, index) => (
							<div key={`${message.id || index}-${index}`} className={index > 0 ? "mt-4" : ""}>
								<ChatMessage
									conversationId={currentConversationId}
									message={message}
									modelConfig={getModelByReference(modelReferences, message.model)}
									onToolInteraction={onToolInteraction}
									onArtifactOpen={onArtifactOpen}
									isSharedView={isSharedView}
									onRetry={retryMessage}
									isRetrying={streamStarted}
									onEdit={message.id ? () => startEditingMessage(message.id!) : undefined}
									isEditing={editingMessageId === message.id}
									onSaveEdit={(newContent) => {
										if (message.id) {
											updateUserMessage(message.id, newContent);
											stopEditingMessage();
										}
									}}
									onCancelEdit={stopEditingMessage}
									onBranch={onBranch}
									isBranching={isBranching}
									onRequestOpinion={
										opinionAvailability.get(message.id)?.canRequest ? onRequestOpinion : undefined
									}
									isRequestingOpinion={isRequestingOpinion}
									shouldPromoteOpinion={opinionAvailability.get(message.id)?.shouldPromote ?? false}
								/>
							</div>
						))}
						{!isSharedView && (isStreamLoading || streamStarted) && (
							<div className="flex items-center gap-2 py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400">
								<Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
								<span>{streamLoadingMessage}</span>
							</div>
						)}
						{!isSharedView && isModelInitializing && (
							<div className="flex items-center gap-2 py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400">
								<Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
								<span>
									{modelInitMessage}
									{modelInitProgress !== undefined ? ` ${Math.round(modelInitProgress)}%` : null}
								</span>
							</div>
						)}
					</>
				)}
			</VList>
			{showScroll && !isSharedView && (
				<div className="absolute bottom-2 right-2 z-10">
					<ScrollButton
						onClick={() => {
							isNearBottomRef.current = true;
							virtualRef.current?.scrollToIndex(messages.length - 1, {
								align: "end",
							});
						}}
					/>
				</div>
			)}
		</div>
	);
};
