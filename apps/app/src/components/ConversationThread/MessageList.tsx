import { Loader2, ScrollText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { VList, type VListHandle } from "virtua";

import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import { useCanAccessProFeatures } from "~/hooks/useCanAccessProFeatures";
import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import {
	getCompactionMessageLabel,
	isCompactionLoadingMessage,
} from "~/lib/chat/compaction-status";
import {
	canOfferOpinionRequestForMessage,
	shouldPromoteOpinionRequest,
	type OpinionRequest,
} from "~/lib/chat/opinion";
import {
	createModelReferenceMap,
	EMPTY_MODEL_CONFIG,
	getAvailableModels,
	getModelByReference,
} from "~/lib/models";
import { isHiddenToolResponse } from "~/lib/tool-results";
import {
	useIsLoading,
	useLoadingMessage,
	useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { Message } from "~/types";
import type { ArtifactProps } from "~/types/artifact";
import { ChatMessage } from "./ChatMessage";
import { getMessageListScrollKey } from "./messageListScroll";
import { MessageSkeleton } from "./MessageSkeleton";
import { ScrollButton } from "./ScrollButton";

interface MessageListProps {
	onToolInteraction?: (toolName: string, action: "useAsPrompt", data: Record<string, any>) => void;
	onConnectorApproval?: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
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

function CompactionStatusRow({ label, pending = false }: { label: string; pending?: boolean }) {
	return (
		<div
			role="status"
			aria-label={label}
			className="flex items-center gap-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400"
		>
			<div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
			<div className="flex min-w-0 items-center gap-2">
				{pending ? null : <ScrollText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
				<span className="truncate">{label}</span>
			</div>
			<div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
		</div>
	);
}

function hasCurrentResponseCompactionMarker(messages: Message[]): boolean {
	for (let index = messages.length - 1; index > 0; index--) {
		if (messages[index]?.role === "assistant") {
			const previousMessage = messages[index - 1];
			return previousMessage ? Boolean(getCompactionMessageLabel(previousMessage)) : false;
		}
	}

	return false;
}

export const MessageList = ({
	onToolInteraction,
	onConnectorApproval,
	onArtifactOpen,
	messages: propMessages,
	isSharedView = false,
	onBranch,
	isBranching = false,
	onRequestOpinion,
	isRequestingOpinion = false,
}: MessageListProps) => {
	const { chatMode, currentConversationId } = useChatStore();

	const { data: conversation, isLoading: isLoadingConversation } = useChat(
		!isSharedView ? currentConversationId : undefined,
	);
	const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
	const webLLMModels = useWebLLMModels({ enabled: chatMode === "local" });
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
	const availableModels = useMemo(
		() => getAvailableModels(apiModels, chatMode === "local", webLLMModels),
		[apiModels, chatMode, webLLMModels],
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
	const showCompactionLoadingDivider =
		isCompactionLoadingMessage(streamLoadingMessage) &&
		!hasCurrentResponseCompactionMarker(messages);
	const latestCompactionMarkerIndex = useMemo(
		() =>
			messages.reduce(
				(latestIndex, message, index) => (getCompactionMessageLabel(message) ? index : latestIndex),
				-1,
			),
		[messages],
	);

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
				data-header-scroll-source
				className="flex-1 pt-4 pr-2 h-full overflow-auto w-full"
				onScroll={handleScroll}
			>
				<div className="space-y-4">
					{!isSharedView && isLoadingConversation ? (
						<>
							{[...Array(3)].map((_, i) => (
								<MessageSkeleton key={`skeleton-item-${i}`} />
							))}
						</>
					) : (
						messages.map((message, index) => {
							if (isHiddenToolResponse(message)) return null;
							const compactionLabel = getCompactionMessageLabel(message);

							return (
								<div key={`${message.id || index}-${index}`} className={index > 0 ? "mt-4" : ""}>
									{compactionLabel ? (
										<CompactionStatusRow label={compactionLabel} />
									) : (
										<ChatMessage
											conversationId={currentConversationId}
											canSubmitFeedback={Boolean(conversation && !conversation.isLocalOnly)}
											message={message}
											modelConfig={getModelByReference(modelReferences, message.model)}
											onToolInteraction={onToolInteraction}
											onConnectorApproval={onConnectorApproval}
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
												opinionAvailability.get(message.id)?.canRequest
													? onRequestOpinion
													: undefined
											}
											isRequestingOpinion={isRequestingOpinion}
											isArchivedByCompaction={
												latestCompactionMarkerIndex !== -1 && index < latestCompactionMarkerIndex
											}
										/>
									)}
								</div>
							);
						})
					)}
					{!isSharedView && (isStreamLoading || streamStarted) && (
						<>
							{isCompactionLoadingMessage(streamLoadingMessage) ? (
								showCompactionLoadingDivider ? (
									<CompactionStatusRow label={streamLoadingMessage} pending />
								) : null
							) : (
								<div className="flex items-center gap-2 py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400">
									<Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
									<span>{streamLoadingMessage}</span>
								</div>
							)}
						</>
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
				</div>
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
