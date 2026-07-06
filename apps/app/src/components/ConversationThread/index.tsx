import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { ConversationModeMetadata } from "@assistant/schemas";

import "~/styles/scrollbar.css";
import "~/styles/github.css";
import "~/styles/github-dark.css";
import { UsageLimitWarning } from "~/components/ConversationThread/UsageLimitWarning";
import { EventCategory, useTrackEvent } from "~/hooks/use-track-event";
import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import { useModels } from "~/hooks/useModels";
import type { AttachmentData } from "~/lib/chat/attachments";
import { isCompactConversationCommand } from "~/lib/chat/compaction-command";
import {
	createModelReferenceMap,
	EMPTY_MODEL_CONFIG,
	getModelByReference,
	isImageGenerationOutputModel,
} from "~/lib/models";
import { useIsLoading } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatRequestOptions, ModelSelectionChangeHandler, ModelSelectorScope } from "~/types";
import type { CouncilMemberId } from "@assistant/schemas";
import type { ArtifactProps } from "~/types/artifact";
import { ArtifactPanel } from "./Artifacts/ArtifactPanel";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import type { ComposerCommandAction } from "./ChatInput/composerCommandTypes";
import { FooterInfo } from "./FooterInfo";
import { MessageList } from "./MessageList";
import { StealthModelWarning } from "./StealthModelWarning";
import { useAssistantActionSubmit } from "./useAssistantActionSubmit";
import { useAutoPlayResponses } from "./useAutoPlayResponses";
import { WelcomeScreen } from "./WelcomeScreen";
import { findLatestArtifactByIdentifier } from "~/lib/artifacts";

export interface ConversationThreadModeConfig {
	requestOptions?: ChatRequestOptions;
	initialAutoSubmit?: {
		key: string;
		input: string;
	};
	conversationMode?: ConversationModeMetadata;
	welcomeTitle?: string;
	welcomeDescription?: string;
	welcomeSampleQuestions?: Array<{
		id: string;
		text: string;
		question: string;
		category: string;
	}> | null;
	inputPlaceholder?: {
		newConversation: string;
		followUp: string;
	};
	inputControls?: ReactNode;
	modeControls?: {
		activeModeControls?: ReactNode;
		commands?: ComposerCommandAction[];
		includeSettingCommands?: boolean;
		onClearActive?: () => void;
	};
	modelProviderFilter?: string;
	modelScope?: ModelSelectorScope;
	onModelChange?: ModelSelectionChangeHandler;
	hideDefaultControls?: boolean;
	hideComposerActionMenu?: boolean;
	hideSubmitButton?: boolean;
	hideTextInput?: boolean;
	hideInlineResponseControls?: boolean;
	hideChatSettings?: boolean;
	forceAutoPlayResponses?: boolean;
	analyticsSource?: string;
	councilDebate?: {
		enabled: boolean;
		memberIds: CouncilMemberId[];
		requireConsensus?: boolean;
	};
}

interface ConversationThreadProps {
	modeConfig?: ConversationThreadModeConfig;
}

export const ConversationThread = ({ modeConfig }: ConversationThreadProps) => {
	const navigate = useNavigate();
	const { trackEvent, trackFeatureUsage, trackError } = useTrackEvent();

	const {
		currentConversationId,
		model,
		chatInput,
		setChatInput,
		selectedAssistantAction,
		setSelectedAssistantAction,
	} = useChatStore();
	const { data: currentConversation } = useChat(currentConversationId);
	const {
		streamStarted,
		controller,
		compactConversation,
		sendMessage,
		sendCouncilDebate,
		abortStream,
		branchConversation,
		isBranching,
		requestOpinion,
		isRequestingOpinion,
	} = useChatManager(modeConfig?.requestOptions, modeConfig?.conversationMode);
	const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
	const modelReferences = useMemo(() => createModelReferenceMap(apiModels), [apiModels]);
	const selectedModelConfig = useMemo(
		() => getModelByReference(modelReferences, model),
		[modelReferences, model],
	);

	const [currentArtifact, setCurrentArtifact] = useState<ArtifactProps | null>(null);
	const [isPanelVisible, setIsPanelVisible] = useState(false);
	const [currentArtifacts, setCurrentArtifacts] = useState<ArtifactProps[]>([]);
	const [isCombinedPanel, setIsCombinedPanel] = useState(false);
	const [artifactContextAttachments, setArtifactContextAttachments] = useState<AttachmentData[]>(
		[],
	);
	const [autoPlayResponsesEnabled, setAutoPlayResponsesEnabled] = useState(false);
	const effectiveAutoPlayResponsesEnabled =
		autoPlayResponsesEnabled || Boolean(modeConfig?.forceAutoPlayResponses);

	const isStreamLoading = useIsLoading("stream-response");
	const isModelInitializing = useIsLoading("model-init");

	const messages = useMemo(
		() => currentConversation?.messages || [],
		[currentConversation?.messages],
	);

	const chatInputRef = useRef<ChatInputHandle>(null);
	const autoSubmittedKeyRef = useRef<string | null>(null);
	const { resolveAssistantActionSubmit } = useAssistantActionSubmit();
	const {
		isGeneratingSpeech: isGeneratingAutoResponseSpeech,
		isPlaying: isPlayingAutoResponse,
		stopPlayback,
	} = useAutoPlayResponses({
		conversationId: currentConversationId,
		messages,
		isEnabled: effectiveAutoPlayResponsesEnabled,
		isStreaming: isStreamLoading || streamStarted,
	});

	const handleAutoPlayToggle = useCallback(() => {
		if (autoPlayResponsesEnabled) {
			stopPlayback();
		}
		setAutoPlayResponsesEnabled(!autoPlayResponsesEnabled);
	}, [autoPlayResponsesEnabled, stopPlayback]);

	const handleArtifactOpen = useCallback(
		(artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => {
			setCurrentArtifact(artifact);
			setIsPanelVisible(true);

			trackFeatureUsage("view_artifact", {
				artifact_type: artifact.type,
				conversation_id: currentConversationId || "none",
				combined_view: Boolean(combine && artifacts && artifacts.length > 1),
			});

			if (combine && artifacts && artifacts.length > 1) {
				setCurrentArtifacts(artifacts);
				setIsCombinedPanel(true);
				return;
			}

			setCurrentArtifacts([]);
			setIsCombinedPanel(false);
		},
		[currentConversationId, trackFeatureUsage],
	);

	const handlePanelClose = useCallback(() => {
		if (currentArtifact) {
			trackFeatureUsage("close_artifact", {
				artifact_type: currentArtifact.type,
				conversation_id: currentConversationId || "none",
			});
		}

		setIsPanelVisible(false);
		setIsCombinedPanel(false);

		setTimeout(() => {
			setCurrentArtifact(null);
			setCurrentArtifacts([]);
		}, 300);
	}, [currentArtifact, currentConversationId, trackFeatureUsage]);

	const handleAddArtifactSelectionToChat = useCallback(
		(attachment: AttachmentData) => {
			setArtifactContextAttachments((currentAttachments) => [...currentAttachments, attachment]);
			chatInputRef.current?.focus();

			trackFeatureUsage("add_artifact_selection_to_chat", {
				conversation_id: currentConversationId || "none",
				artifact_type: currentArtifact?.type || "unknown",
			});
		},
		[currentArtifact?.type, currentConversationId, trackFeatureUsage],
	);

	const handleRemoveArtifactContextAttachment = useCallback((indexToRemove: number) => {
		setArtifactContextAttachments((currentAttachments) =>
			currentAttachments.filter((_, index) => index !== indexToRemove),
		);
	}, []);

	const handleClearArtifactContextAttachments = useCallback(() => {
		setArtifactContextAttachments([]);
	}, []);

	useEffect(() => {
		if (isPanelVisible) {
			handlePanelClose();
		}
	}, [currentConversationId]);

	useEffect(() => {
		if (!currentArtifact || !isPanelVisible || isCombinedPanel) {
			return;
		}

		const latestArtifact = findLatestArtifactByIdentifier(messages, currentArtifact.identifier);
		if (latestArtifact && latestArtifact.content !== currentArtifact.content) {
			setCurrentArtifact(latestArtifact);
		}
	}, [currentArtifact, isCombinedPanel, isPanelVisible, messages]);

	const canSubmit = useMemo(
		() =>
			(chatInput.trim() || selectedAssistantAction?.item) &&
			!isStreamLoading &&
			!isModelInitializing,
		[chatInput, isStreamLoading, isModelInitializing, selectedAssistantAction?.item],
	);

	const handleSubmit = useCallback(
		async (attachments?: AttachmentData[]) => {
			if (!chatInput.trim() && !attachments?.length && !selectedAssistantAction?.item) {
				return;
			}

			if (isCompactConversationCommand(chatInput) && !selectedAssistantAction?.item) {
				const originalInput = chatInput;
				setChatInput("");
				setSelectedAssistantAction(null);

				const result = await compactConversation();
				if (result.status === "error") {
					setChatInput(originalInput);
					if (result.response) {
						toast.error(result.response);
					}
				}
				return;
			}

			// For text-to-image models, only allow the first message unless they support image edits
			if (selectedModelConfig) {
				if (
					isImageGenerationOutputModel(selectedModelConfig) &&
					!selectedModelConfig.supportsImageEdits &&
					messages.length > 0
				) {
					toast.error(
						"Text-to-image models only support one message per conversation. Please start a new conversation.",
					);
					return;
				}
			}

			const originalInput = chatInput;
			const originalAssistantAction = selectedAssistantAction;

			try {
				const actionSubmit = await resolveAssistantActionSubmit(chatInput);
				setChatInput("");
				setSelectedAssistantAction(null);

				trackEvent({
					name: "send_message",
					category: EventCategory.CONVERSATION,
					properties: {
						conversation_id: currentConversationId || "new",
						source: modeConfig?.analyticsSource,
						model_id: model || "unknown",
						message_length: chatInput.length,
						has_attachment: Boolean(attachments?.length),
						attachment_count: attachments?.length ?? 0,
						attachment_type: attachments?.[0]?.type,
						attachment_types: attachments?.map((attachment) => attachment.type).join(","),
						is_first_message: messages.length === 0,
					},
				});

				if (actionSubmit.kind === "external") {
					window.location.href = actionSubmit.url;
					return;
				}

				if (actionSubmit.kind === "navigation") {
					navigate(actionSubmit.path);
					return;
				}

				const result = modeConfig?.councilDebate?.enabled
					? await sendCouncilDebate(actionSubmit.input, attachments, modeConfig.councilDebate)
					: await sendMessage(actionSubmit.input, attachments, actionSubmit.requestOptions);
				if (result?.status === "error") {
					setChatInput(originalInput);
					setSelectedAssistantAction(originalAssistantAction);
					if (result.response) {
						toast.error(result.response);
					}
				} else {
					setTimeout(() => {
						chatInputRef.current?.focus();
					}, 0);
				}
			} catch (error) {
				setChatInput(originalInput);
				setSelectedAssistantAction(originalAssistantAction);
				toast.error(error instanceof Error ? error.message : "Failed to send message");
				console.error("Failed to send message:", error);
				trackError("message_send_error", error, {
					conversation_id: currentConversationId || "new",
					model_id: model || "unknown",
				});
			}
		},
		[
			chatInput,
			model,
			messages,
			compactConversation,
			sendMessage,
			sendCouncilDebate,
			resolveAssistantActionSubmit,
			trackEvent,
			trackError,
			currentConversationId,
			setChatInput,
			setSelectedAssistantAction,
			selectedAssistantAction,
			selectedAssistantAction?.item,
			selectedModelConfig,
			modeConfig?.analyticsSource,
			modeConfig?.councilDebate,
			navigate,
		],
	);

	useEffect(() => {
		const initialAutoSubmit = modeConfig?.initialAutoSubmit;
		if (!initialAutoSubmit || autoSubmittedKeyRef.current === initialAutoSubmit.key) {
			return;
		}

		autoSubmittedKeyRef.current = initialAutoSubmit.key;
		setChatInput("");
		sendMessage(initialAutoSubmit.input);
	}, [modeConfig?.initialAutoSubmit, sendMessage, setChatInput]);

	const handleKeyPress = useCallback(
		(e: KeyboardEvent) => {
			if (isStreamLoading || isModelInitializing) return;

			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				if (canSubmit) {
					handleSubmit();
				}
			}
			if (e.key === "Escape") {
				if (isPanelVisible) {
					handlePanelClose();
				} else if (controller) {
					abortStream();
					setTimeout(() => {
						chatInputRef.current?.focus();
					}, 0);
				}
			}
		},
		[
			canSubmit,
			controller,
			abortStream,
			isPanelVisible,
			handlePanelClose,
			isStreamLoading,
			isModelInitializing,
			handleSubmit,
		],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyPress);
		return () => {
			window.removeEventListener("keydown", handleKeyPress);
		};
	}, [handleKeyPress]);

	const handleTranscribe = useCallback(
		async (data: {
			response: {
				content: string;
			};
		}) => {
			setChatInput(data.response.content);
			trackFeatureUsage("transcription_used", {
				conversation_id: currentConversationId || "new",
				content_length: data.response.content.length,
			});
		},
		[currentConversationId, trackFeatureUsage, setChatInput],
	);

	const handleToolInteraction = useCallback(
		(toolName: string, action: "useAsPrompt", data: Record<string, any>) => {
			trackFeatureUsage("tool_interaction", {
				tool_name: toolName,
				action: action,
				conversation_id: currentConversationId || "new",
			});

			switch (toolName) {
				case "web_search":
					if (action === "useAsPrompt") {
						setChatInput(data.question);
					}
					break;
				default:
					break;
			}
		},
		[currentConversationId, trackFeatureUsage, setChatInput],
	);

	const showWelcomeScreen =
		messages.length === 0 && !currentConversationId && !isStreamLoading && !streamStarted;

	const handleBranch = useCallback(
		(messageId: string, modelId?: string) => {
			branchConversation(messageId, modelId);
		},
		[branchConversation],
	);

	return (
		<div
			className={`relative flex h-full min-h-0 w-full flex-col ${isPanelVisible ? "pr-[90%] sm:pr-[350px] md:pr-[400px] lg:pr-[650px]" : ""}`}
		>
			{showWelcomeScreen ? (
				<div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-0 py-6 sm:py-8">
					<div className="my-auto w-full">
						<WelcomeScreen
							setInput={setChatInput}
							title={modeConfig?.welcomeTitle}
							description={modeConfig?.welcomeDescription}
							sampleQuestions={modeConfig?.welcomeSampleQuestions}
						/>
					</div>
				</div>
			) : (
				<div className="min-h-0 flex-1 px-4">
					<div className="mx-auto w-full max-w-3xl h-full flex flex-col gap-8">
						<MessageList
							messages={messages}
							onToolInteraction={handleToolInteraction}
							onArtifactOpen={handleArtifactOpen}
							onBranch={handleBranch}
							isBranching={isBranching}
							onRequestOpinion={requestOpinion}
							isRequestingOpinion={isRequestingOpinion}
						/>
					</div>
				</div>
			)}

			<div className="relative z-10 shrink-0 px-4 pt-2">
				<div className="max-w-3xl mx-auto">
					<StealthModelWarning model={selectedModelConfig} />
					<UsageLimitWarning />
					<ChatInput
						ref={chatInputRef}
						handleSubmit={handleSubmit}
						isLoading={isStreamLoading || isModelInitializing}
						streamStarted={streamStarted}
						controller={controller}
						onTranscribe={handleTranscribe}
						placeholder={modeConfig?.inputPlaceholder}
						controls={modeConfig?.inputControls}
						modeControls={modeConfig?.modeControls}
						modelProviderFilter={modeConfig?.modelProviderFilter}
						modelScope={modeConfig?.modelScope}
						onModelChange={modeConfig?.onModelChange}
						hideDefaultControls={modeConfig?.hideDefaultControls}
						hideComposerActionMenu={modeConfig?.hideComposerActionMenu}
						hideSubmitButton={modeConfig?.hideSubmitButton}
						hideTextInput={modeConfig?.hideTextInput}
						hideInlineResponseControls={modeConfig?.hideInlineResponseControls}
						hideChatSettings={modeConfig?.hideChatSettings}
						contextAttachments={artifactContextAttachments}
						onRemoveContextAttachment={handleRemoveArtifactContextAttachment}
						onClearContextAttachments={handleClearArtifactContextAttachments}
						autoPlayResponses={{
							enabled: effectiveAutoPlayResponsesEnabled,
							isGenerating: isGeneratingAutoResponseSpeech,
							isPlaying: isPlayingAutoResponse,
							onToggle: handleAutoPlayToggle,
						}}
					/>
				</div>
			</div>

			<FooterInfo isPanelVisible={isPanelVisible} />

			<ArtifactPanel
				artifact={currentArtifact}
				artifacts={currentArtifacts}
				onClose={handlePanelClose}
				onAddSelectionToChat={handleAddArtifactSelectionToChat}
				isVisible={isPanelVisible}
				isCombined={isCombinedPanel}
			/>
		</div>
	);
};
