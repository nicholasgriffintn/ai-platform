import {
	defaultCouncilMemberIds,
	type CouncilMemberId,
} from "@ngriffin_uk/polychat-schemas/council-data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { CouncilChatControls } from "~/components/Council/CouncilChatControls";
import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import {
	useLiveConversationMessages,
	type FinalLiveInputTranscript,
} from "~/hooks/useLiveConversationMessages";
import { useModels } from "~/hooks/useModels";
import { useRealtimeLiveSession } from "~/hooks/useRealtimeLiveSession";
import {
	buildConversationModeMetadata,
	getConversationModeMetadata,
} from "~/lib/home-chat-modes/conversation-mode";
import { createModelReferenceMap, EMPTY_MODEL_CONFIG, getModelByReference } from "~/lib/models";
import {
	getComposedRealtimeReasoningModelId,
	getDefaultLiveModelId,
	getRealtimeLiveProviderIdForModel,
	isComposedRealtimeLiveProvider,
	supportsRealtimeLiveVideoInput,
	waitsForRealtimeLiveProviderFinalEventOnStop,
	type RealtimeLiveProviderId,
} from "~/lib/realtime/live-providers";
import { useChatStore } from "~/state/stores/chatStore";
import type { ModelSelectionChangeHandler } from "~/types";
import type { HomeChatModeId } from "@ngriffin_uk/polychat-schemas";
import { LiveChatModeControls, LiveSessionComposerControls } from "./LiveChatModeControls";
import {
	HOME_CHAT_MODE_OPTIONS,
	getHomeChatModeAvailability,
	resolveHomeChatModeId,
} from "./chatModes";

type CouncilResponseMode = "debate" | "single";

function supportsBackgroundResponses(modelConfig: { provider?: string } | null | undefined) {
	return modelConfig?.provider === "openai";
}

export function useHomeChatModeConfig(): {
	activeModeId: HomeChatModeId;
	modeConfig: ConversationThreadModeConfig;
} {
	const [searchParams, setSearchParams] = useSearchParams();
	const {
		currentConversationId,
		homeChatMode,
		setHomeChatMode,
		setChatMode,
		setSelectedAgentId,
		model: selectedModel,
		setModel,
	} = useChatStore();
	const { data: currentConversation } = useChat(currentConversationId);
	const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
	const conversationModeMetadata = useMemo(
		() => getConversationModeMetadata(currentConversation),
		[currentConversation],
	);
	const modelReferences = useMemo(() => createModelReferenceMap(apiModels), [apiModels]);
	const selectedModelConfig = useMemo(
		() => getModelByReference(modelReferences, selectedModel),
		[modelReferences, selectedModel],
	);
	const canUseBackgroundMode = supportsBackgroundResponses(selectedModelConfig);
	const composedReasoningModel = useMemo(
		() => getComposedRealtimeReasoningModelId(apiModels, selectedModel),
		[apiModels, selectedModel],
	);
	const selectedModelLiveProvider = getRealtimeLiveProviderIdForModel(selectedModelConfig);
	const [activeModeId, setActiveModeId] = useState<HomeChatModeId>(() =>
		resolveHomeChatModeId(searchParams.has("mode") ? searchParams.get("mode") : homeChatMode),
	);
	const effectiveActiveModeId =
		activeModeId === "background" && !canUseBackgroundMode ? "chat" : activeModeId;
	const [selectedCouncilMemberIds, setSelectedCouncilMemberIds] = useState<CouncilMemberId[]>([
		...defaultCouncilMemberIds,
	]);
	const [councilResponseMode, setCouncilResponseMode] = useState<CouncilResponseMode>("debate");
	const hydratedConversationIdRef = useRef<string | undefined>(undefined);
	const liveConversationMode = useMemo(
		() =>
			buildConversationModeMetadata({
				mode: "live",
			}),
		[],
	);
	const effectiveLiveProviderRef = useRef<RealtimeLiveProviderId | undefined>(undefined);
	const { respondToExistingConversation } = useChatManager(undefined, liveConversationMode);
	const handleFinalLiveInputTranscript = useCallback(
		({ assistantMessageData, conversationId }: FinalLiveInputTranscript) => {
			const provider = effectiveLiveProviderRef.current;
			if (!provider || !isComposedRealtimeLiveProvider(provider)) {
				return;
			}

			if (!composedReasoningModel) {
				return;
			}

			void respondToExistingConversation(conversationId, {
				assistantMessageData,
				model: composedReasoningModel,
			});
		},
		[composedReasoningModel, respondToExistingConversation],
	);
	const {
		flushLiveMessages,
		handleRealtimeEvent: handleLiveRealtimeEvent,
		handleTranscript: handleLiveTranscript,
	} = useLiveConversationMessages({
		conversationMode: liveConversationMode,
		model: selectedModel,
		onFinalInputTranscript: handleFinalLiveInputTranscript,
	});
	const liveSession = useRealtimeLiveSession({
		model: selectedModel,
		onEvent: handleLiveRealtimeEvent,
		onTranscript: handleLiveTranscript,
	});
	const {
		error: liveError,
		cameraDevices: liveCameraDevices,
		inputAudioLevel: liveInputAudioLevel,
		isMicrophoneEnabled: liveMicrophoneEnabled,
		isVideoEnabled: liveVideoEnabled,
		lastEvent: liveLastEvent,
		lastTranscript: liveLastTranscript,
		outputAudioLevel: liveOutputAudioLevel,
		provider: liveProvider,
		selectedCameraDeviceId: liveSelectedCameraDeviceId,
		setCameraDeviceId: setLiveCameraDeviceId,
		setMicrophoneEnabled: setLiveMicrophoneEnabled,
		setProvider: setLiveProvider,
		setVideoEnabled: setLiveVideoEnabled,
		start: startLiveSession,
		status: liveStatus,
		stop: stopLiveSession,
		videoPreviewStream: liveVideoPreviewStream,
	} = liveSession;
	const stopLiveSessionAndFlush = useCallback(() => {
		if (
			waitsForRealtimeLiveProviderFinalEventOnStop(effectiveLiveProviderRef.current ?? liveProvider)
		) {
			stopLiveSession();
			return;
		}

		flushLiveMessages();
		stopLiveSession();
	}, [flushLiveMessages, liveProvider, stopLiveSession]);
	const effectiveLiveProvider = selectedModelLiveProvider ?? liveProvider;
	effectiveLiveProviderRef.current = effectiveLiveProvider;
	const forceLiveResponseAudio = isComposedRealtimeLiveProvider(effectiveLiveProvider);

	useEffect(() => {
		if (
			effectiveActiveModeId !== "live" ||
			!selectedModelLiveProvider ||
			selectedModelLiveProvider === liveProvider
		) {
			return;
		}

		setLiveProvider(selectedModelLiveProvider);
	}, [effectiveActiveModeId, liveProvider, selectedModelLiveProvider, setLiveProvider]);

	useEffect(() => {
		if (activeModeId !== "background" || canUseBackgroundMode) {
			return;
		}

		const next = new URLSearchParams(searchParams);
		next.delete("mode");
		setActiveModeId("chat");
		setHomeChatMode("chat");
		setSearchParams(next, { replace: true });
	}, [activeModeId, canUseBackgroundMode, searchParams, setHomeChatMode, setSearchParams]);

	useEffect(() => {
		if (currentConversationId && conversationModeMetadata) {
			return;
		}
		setActiveModeId(
			resolveHomeChatModeId(searchParams.has("mode") ? searchParams.get("mode") : homeChatMode),
		);
	}, [conversationModeMetadata, currentConversationId, homeChatMode, searchParams]);

	useEffect(() => {
		if (!currentConversationId) {
			hydratedConversationIdRef.current = undefined;
			return;
		}
		if (!conversationModeMetadata || hydratedConversationIdRef.current === currentConversationId) {
			return;
		}

		hydratedConversationIdRef.current = currentConversationId;
		setActiveModeId(resolveHomeChatModeId(conversationModeMetadata.mode));
	}, [conversationModeMetadata, currentConversationId]);

	useEffect(() => {
		if (activeModeId === "chat") {
			return;
		}
		setSelectedAgentId(null);
		setChatMode("remote");
	}, [activeModeId, setChatMode, setSelectedAgentId]);

	const handleModeChange = useCallback(
		(modeId: HomeChatModeId) => {
			if (modeId === "background" && !canUseBackgroundMode) {
				return;
			}

			setActiveModeId(modeId);
			setHomeChatMode(modeId);
			const next = new URLSearchParams(searchParams);
			if (modeId === "chat") {
				next.delete("mode");
			} else {
				next.set("mode", modeId);
				setSelectedAgentId(null);
				setChatMode("remote");
			}
			if (modeId === "live") {
				const nextLiveProvider = selectedModelLiveProvider ?? liveProvider;
				setLiveProvider(nextLiveProvider);
				if (!selectedModelLiveProvider) {
					setModel(getDefaultLiveModelId(nextLiveProvider));
				}
			} else if (effectiveActiveModeId === "live") {
				stopLiveSessionAndFlush();
			}
			setSearchParams(next, { replace: true });
		},
		[
			canUseBackgroundMode,
			effectiveActiveModeId,
			liveProvider,
			searchParams,
			selectedModelLiveProvider,
			setChatMode,
			setHomeChatMode,
			setLiveProvider,
			setModel,
			setSearchParams,
			setSelectedAgentId,
			stopLiveSessionAndFlush,
		],
	);
	const handleLiveProviderChange = useCallback(
		(provider: RealtimeLiveProviderId) => {
			setLiveProvider(provider);
			setModel(getDefaultLiveModelId(provider));
		},
		[setLiveProvider, setModel],
	);
	const handleModelChange = useCallback<ModelSelectionChangeHandler>(
		(modelId, modelConfig) => {
			const selectedConfig = modelConfig ?? getModelByReference(modelReferences, modelId);
			const nextLiveProvider = getRealtimeLiveProviderIdForModel(selectedConfig);
			const next = new URLSearchParams(searchParams);

			if (nextLiveProvider) {
				setActiveModeId("live");
				setHomeChatMode("live");
				setSelectedAgentId(null);
				setChatMode("remote");
				setLiveProvider(nextLiveProvider);
				next.set("mode", "live");
				setSearchParams(next, { replace: true });
				return;
			}

			if (effectiveActiveModeId !== "live") {
				return;
			}

			stopLiveSessionAndFlush();
			setActiveModeId("chat");
			setHomeChatMode("chat");
			setChatMode("remote");
			next.delete("mode");
			setSearchParams(next, { replace: true });
		},
		[
			effectiveActiveModeId,
			modelReferences,
			searchParams,
			setChatMode,
			setHomeChatMode,
			setLiveProvider,
			setSearchParams,
			setSelectedAgentId,
			stopLiveSessionAndFlush,
		],
	);

	return useMemo<{
		activeModeId: HomeChatModeId;
		modeConfig: ConversationThreadModeConfig;
	}>(() => {
		const councilControls = (
			<CouncilChatControls
				selectedMemberIds={selectedCouncilMemberIds}
				onSelectedMemberIdsChange={setSelectedCouncilMemberIds}
				responseMode={councilResponseMode}
				onResponseModeChange={setCouncilResponseMode}
				showHeader={effectiveActiveModeId !== "council"}
			/>
		);
		const liveControls = (
			<LiveChatModeControls
				cameraDevices={liveCameraDevices}
				error={liveError}
				lastEvent={liveLastEvent}
				lastTranscript={liveLastTranscript}
				microphoneEnabled={liveMicrophoneEnabled}
				onCameraDeviceChange={setLiveCameraDeviceId}
				onProviderChange={handleLiveProviderChange}
				onMicrophoneEnabledChange={setLiveMicrophoneEnabled}
				onStart={() => void startLiveSession(effectiveLiveProvider, selectedModel)}
				onStop={stopLiveSessionAndFlush}
				onVideoEnabledChange={setLiveVideoEnabled}
				provider={effectiveLiveProvider}
				showHeader={effectiveActiveModeId !== "live"}
				showSessionControls={effectiveActiveModeId !== "live"}
				status={liveStatus}
				selectedCameraDeviceId={liveSelectedCameraDeviceId}
				videoEnabled={liveVideoEnabled}
				videoPreviewStream={liveVideoPreviewStream}
			/>
		);
		const liveInputControls = (
			<LiveSessionComposerControls
				cameraDevices={liveCameraDevices}
				error={liveError}
				inputAudioLevel={liveInputAudioLevel}
				lastEvent={liveLastEvent}
				lastTranscript={liveLastTranscript}
				microphoneEnabled={liveMicrophoneEnabled}
				onCameraDeviceChange={setLiveCameraDeviceId}
				onMicrophoneEnabledChange={setLiveMicrophoneEnabled}
				onStart={() => void startLiveSession(effectiveLiveProvider, selectedModel)}
				onStop={stopLiveSessionAndFlush}
				onVideoEnabledChange={setLiveVideoEnabled}
				outputAudioLevel={liveOutputAudioLevel}
				selectedCameraDeviceId={liveSelectedCameraDeviceId}
				status={liveStatus}
				videoEnabled={liveVideoEnabled}
				videoPreviewStream={liveVideoPreviewStream}
				videoSupported={supportsRealtimeLiveVideoInput(effectiveLiveProvider)}
			/>
		);
		const activeModeControls =
			effectiveActiveModeId === "council"
				? councilControls
				: effectiveActiveModeId === "live"
					? liveControls
					: undefined;
		const modeControls = {
			activeModeControls,
			commands: HOME_CHAT_MODE_OPTIONS.map((option) => {
				const availability =
					option.id === "background" && !canUseBackgroundMode
						? {
								disabled: true,
								reason: "Background mode requires an OpenAI Responses model.",
							}
						: getHomeChatModeAvailability(option, effectiveActiveModeId);
				const Icon = option.icon;
				return {
					id: option.id,
					label: option.label,
					description: option.description,
					command: option.id,
					icon: <Icon className="h-4 w-4" aria-hidden="true" />,
					isActive: effectiveActiveModeId === option.id,
					disabled: availability.disabled,
					disabledReason: availability.reason,
					keepPopoverOpen: option.id === "live",
					onSelect: () => handleModeChange(option.id),
				};
			}),
			onClearActive: effectiveActiveModeId === "chat" ? undefined : () => handleModeChange("chat"),
		};

		if (effectiveActiveModeId === "live") {
			return {
				activeModeId: effectiveActiveModeId,
				modeConfig: {
					analyticsSource: "live",
					welcomeTitle: "Start a live session",
					welcomeDescription:
						"Choose a live-capable model, then use voice or camera input in the active session.",
					welcomeSampleQuestions: [],
					inputPlaceholder: {
						newConversation: "Live mode is running. Transcripts can still be edited here...",
						followUp: "Live mode is running. Add notes or follow-up text...",
					},
					inputControls: liveInputControls,
					modelScope: "chat-and-live",
					onModelChange: handleModelChange,
					hideTextInput: true,
					hideComposerActionMenu: true,
					hideSubmitButton: true,
					hideInlineResponseControls: true,
					hideChatSettings: true,
					forceAutoPlayResponses: forceLiveResponseAudio,
					conversationMode: liveConversationMode,
					modeControls,
				},
			};
		}

		if (effectiveActiveModeId === "background") {
			return {
				activeModeId: effectiveActiveModeId,
				modeConfig: {
					analyticsSource: "background",
					welcomeTitle: "What should keep running?",
					welcomeDescription:
						"Describe the work to start, then track approvals, retries, and completion from the conversation.",
					inputPlaceholder: {
						newConversation: "Start background work...",
						followUp: "Add instructions or continue the background response...",
					},
					requestOptions: {
						background: true,
					},
					modelScope: "text-only",
					conversationMode: buildConversationModeMetadata({
						mode: "background",
					}),
					modeControls,
					onModelChange: handleModelChange,
				},
			};
		}

		if (effectiveActiveModeId !== "council") {
			return {
				activeModeId: effectiveActiveModeId,
				modeConfig: {
					modeControls,
					onModelChange: handleModelChange,
				},
			};
		}

		const councilRequestOptions = {
			options: {
				council: {
					enabled: true,
					responseMode: councilResponseMode,
					memberIds: selectedCouncilMemberIds,
					requireConsensus: true,
				},
			},
		};

		return {
			activeModeId: effectiveActiveModeId,
			modeConfig: {
				analyticsSource: "council",
				welcomeTitle: "What should the council debate?",
				welcomeDescription:
					"Pick the council, give them a problem, and let them argue it out properly before answering.",
				inputPlaceholder: {
					newConversation: "Give the council a problem to debate...",
					followUp: "Ask the council to refine its decision...",
				},
				requestOptions: councilRequestOptions,
				modelScope: "text-only",
				conversationMode: buildConversationModeMetadata({
					mode: "council",
					requestOptions: councilRequestOptions,
				}),
				councilDebate:
					councilResponseMode === "debate"
						? {
								enabled: true,
								memberIds: selectedCouncilMemberIds,
								requireConsensus: true,
							}
						: undefined,
				modeControls,
			},
		};
	}, [
		effectiveActiveModeId,
		handleModeChange,
		handleLiveProviderChange,
		handleModelChange,
		selectedCouncilMemberIds,
		councilResponseMode,
		selectedModel,
		liveCameraDevices,
		liveError,
		liveInputAudioLevel,
		liveMicrophoneEnabled,
		liveVideoEnabled,
		liveLastEvent,
		liveLastTranscript,
		liveOutputAudioLevel,
		liveProvider,
		liveSelectedCameraDeviceId,
		liveVideoPreviewStream,
		effectiveLiveProvider,
		composedReasoningModel,
		forceLiveResponseAudio,
		liveStatus,
		liveConversationMode,
		handleFinalLiveInputTranscript,
		setLiveCameraDeviceId,
		setLiveMicrophoneEnabled,
		setLiveVideoEnabled,
		startLiveSession,
		stopLiveSessionAndFlush,
	]);
}
