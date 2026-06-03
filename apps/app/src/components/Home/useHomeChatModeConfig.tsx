import { defaultCouncilMemberIds, type CouncilMemberId } from "@assistant/schemas";
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
	useSandboxConnections,
	useSandboxRepositoryOptions,
	useUpdateSandboxConnectionRepositories,
} from "~/hooks/useSandbox";
import {
	buildConversationModeMetadata,
	getConversationModeMetadata,
} from "~/lib/home-chat-modes/conversation-mode";
import { createModelReferenceMap, getModelByReference } from "~/lib/models";
import {
	getComposedRealtimeReasoningModelId,
	getDefaultLiveModelId,
	getRealtimeLiveProviderIdForModel,
	isComposedRealtimeLiveProvider,
	supportsRealtimeLiveVideoInput,
	waitsForRealtimeLiveProviderFinalEventOnStop,
	type RealtimeLiveProviderId,
} from "~/lib/realtime/live-providers";
import { normaliseGitHubRepoInput } from "~/lib/sandbox/repositories";
import { useChatStore } from "~/state/stores/chatStore";
import {
	SANDBOX_TIMEOUT_DEFAULT_SECONDS,
	SANDBOX_TIMEOUT_MAX_SECONDS,
	SANDBOX_TIMEOUT_MIN_SECONDS,
	type SandboxModelSettings,
	type SandboxPromptStrategy,
	type SandboxTaskType,
} from "~/types/sandbox";
import type { ModelSelectionChangeHandler } from "~/types";
import { LiveChatModeControls, LiveSessionComposerControls } from "./LiveChatModeControls";
import { SandboxChatModeControls } from "./SandboxChatModeControls";
import {
	HOME_CHAT_MODE_OPTIONS,
	getHomeChatModeAvailability,
	type HomeChatModeId,
	resolveHomeChatModeId,
} from "./chatModes";

type CouncilResponseMode = "debate" | "single";

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
		chatSettings,
		sandboxModeSettings,
		setSandboxModeSettings,
	} = useChatStore();
	const { data: currentConversation } = useChat(currentConversationId);
	const { data: apiModels = {} } = useModels();
	const conversationModeMetadata = useMemo(
		() => getConversationModeMetadata(currentConversation),
		[currentConversation],
	);
	const modelReferences = useMemo(() => createModelReferenceMap(apiModels), [apiModels]);
	const selectedModelConfig = useMemo(
		() => getModelByReference(modelReferences, selectedModel),
		[modelReferences, selectedModel],
	);
	const composedReasoningModel = useMemo(
		() => getComposedRealtimeReasoningModelId(apiModels, selectedModel),
		[apiModels, selectedModel],
	);
	const selectedModelLiveProvider = getRealtimeLiveProviderIdForModel(selectedModelConfig);
	const [activeModeId, setActiveModeId] = useState<HomeChatModeId>(() =>
		searchParams.has("mode") ? resolveHomeChatModeId(searchParams.get("mode")) : homeChatMode,
	);
	const [selectedCouncilMemberIds, setSelectedCouncilMemberIds] = useState<CouncilMemberId[]>([
		...defaultCouncilMemberIds,
	]);
	const [councilResponseMode, setCouncilResponseMode] = useState<CouncilResponseMode>("debate");
	const { data: sandboxConnections = [] } = useSandboxConnections();
	const { repoOptions: sandboxRepoOptions, isLoading: isLoadingSandboxRepos } =
		useSandboxRepositoryOptions(sandboxConnections);
	const updateSandboxConnectionRepositories = useUpdateSandboxConnectionRepositories();
	const [sandboxRepoKey, setSandboxRepoKey] = useState(sandboxModeSettings.repoKey ?? "");
	const [sandboxTaskType, setSandboxTaskType] = useState<SandboxTaskType>(
		sandboxModeSettings.taskType ?? "feature-implementation",
	);
	const [sandboxPromptStrategy, setSandboxPromptStrategy] = useState<SandboxPromptStrategy>(
		sandboxModeSettings.promptStrategy ?? "auto",
	);
	const [sandboxTimeoutSecondsInput, setSandboxTimeoutSecondsInput] = useState(
		sandboxModeSettings.timeoutSecondsInput ?? String(SANDBOX_TIMEOUT_DEFAULT_SECONDS),
	);
	const [sandboxShouldCommit, setSandboxShouldCommit] = useState(
		sandboxModeSettings.shouldCommit ?? true,
	);
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
		inputAudioLevel: liveInputAudioLevel,
		isMicrophoneEnabled: liveMicrophoneEnabled,
		isVideoEnabled: liveVideoEnabled,
		lastEvent: liveLastEvent,
		lastTranscript: liveLastTranscript,
		outputAudioLevel: liveOutputAudioLevel,
		provider: liveProvider,
		setMicrophoneEnabled: setLiveMicrophoneEnabled,
		setProvider: setLiveProvider,
		setVideoEnabled: setLiveVideoEnabled,
		start: startLiveSession,
		status: liveStatus,
		stop: stopLiveSession,
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
			activeModeId !== "live" ||
			!selectedModelLiveProvider ||
			selectedModelLiveProvider === liveProvider
		) {
			return;
		}

		setLiveProvider(selectedModelLiveProvider);
	}, [activeModeId, liveProvider, selectedModelLiveProvider, setLiveProvider]);

	useEffect(() => {
		if (currentConversationId && conversationModeMetadata) {
			return;
		}
		setActiveModeId(
			searchParams.has("mode") ? resolveHomeChatModeId(searchParams.get("mode")) : homeChatMode,
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
		setActiveModeId(conversationModeMetadata.mode);
		if (conversationModeMetadata.sandboxSettings) {
			const settings = conversationModeMetadata.sandboxSettings;
			setSandboxRepoKey(settings.repoKey ?? "");
			setSandboxTaskType(settings.taskType ?? "feature-implementation");
			setSandboxPromptStrategy(settings.promptStrategy ?? "auto");
			setSandboxTimeoutSecondsInput(
				settings.timeoutSecondsInput ?? String(SANDBOX_TIMEOUT_DEFAULT_SECONDS),
			);
			setSandboxShouldCommit(settings.shouldCommit ?? true);
		}
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
			} else if (activeModeId === "live") {
				stopLiveSessionAndFlush();
			}
			setSearchParams(next, { replace: true });
		},
		[
			activeModeId,
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

			if (activeModeId !== "live") {
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
			activeModeId,
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

	const selectedSandboxRepoOption = useMemo(
		() => sandboxRepoOptions.find((option) => option.key === sandboxRepoKey),
		[sandboxRepoKey, sandboxRepoOptions],
	);
	const normalisedSandboxRepo = selectedSandboxRepoOption?.repo ?? "";
	const selectedSandboxConnection = useMemo(
		() =>
			selectedSandboxRepoOption
				? sandboxConnections.find(
						(connection) => connection.installationId === selectedSandboxRepoOption.installationId,
					)
				: undefined,
		[sandboxConnections, selectedSandboxRepoOption],
	);
	const canSaveSandboxRepo = Boolean(
		selectedSandboxRepoOption &&
		selectedSandboxConnection &&
		!selectedSandboxRepoOption.isConfigured,
	);
	const handleSaveSandboxRepo = useCallback(() => {
		if (!selectedSandboxRepoOption || !selectedSandboxConnection) {
			return;
		}
		const repositories = Array.from(
			new Set([
				...selectedSandboxConnection.repositories.map((repo) => normaliseGitHubRepoInput(repo)),
				selectedSandboxRepoOption.repo,
			]),
		).filter(Boolean);

		updateSandboxConnectionRepositories.mutate({
			installationId: selectedSandboxRepoOption.installationId,
			input: { repositories },
		});
	}, [selectedSandboxConnection, selectedSandboxRepoOption, updateSandboxConnectionRepositories]);
	const sandboxModelSettings = useMemo<SandboxModelSettings>(
		() => ({
			temperature: chatSettings.temperature,
			top_p: chatSettings.top_p,
			max_tokens: chatSettings.max_tokens,
			presence_penalty: chatSettings.presence_penalty,
			frequency_penalty: chatSettings.frequency_penalty,
			reasoning_effort: chatSettings.reasoning?.effort,
			reasoning: chatSettings.reasoning,
			verbosity: chatSettings.verbosity,
		}),
		[
			chatSettings.temperature,
			chatSettings.top_p,
			chatSettings.max_tokens,
			chatSettings.presence_penalty,
			chatSettings.frequency_penalty,
			chatSettings.reasoning,
			chatSettings.verbosity,
		],
	);
	const parsedSandboxTimeoutSeconds = useMemo(() => {
		const raw = sandboxTimeoutSecondsInput.trim();
		if (!raw) return undefined;
		const parsed = Number.parseInt(raw, 10);
		return Number.isFinite(parsed) ? parsed : Number.NaN;
	}, [sandboxTimeoutSecondsInput]);
	const hasValidSandboxTimeout =
		parsedSandboxTimeoutSeconds === undefined ||
		(Number.isFinite(parsedSandboxTimeoutSeconds) &&
			parsedSandboxTimeoutSeconds >= SANDBOX_TIMEOUT_MIN_SECONDS &&
			parsedSandboxTimeoutSeconds <= SANDBOX_TIMEOUT_MAX_SECONDS);
	const isReadOnlySandboxTaskType =
		sandboxTaskType === "code-review" || sandboxTaskType === "test-suite";

	useEffect(() => {
		if (sandboxRepoOptions.length === 0) {
			if (!isLoadingSandboxRepos && sandboxRepoKey) setSandboxRepoKey("");
			return;
		}
		if (selectedSandboxRepoOption) return;
		setSandboxRepoKey(sandboxRepoOptions[0].key);
	}, [isLoadingSandboxRepos, sandboxRepoKey, sandboxRepoOptions, selectedSandboxRepoOption]);

	useEffect(() => {
		if (isReadOnlySandboxTaskType && sandboxShouldCommit) setSandboxShouldCommit(false);
	}, [isReadOnlySandboxTaskType, sandboxShouldCommit]);

	const sandboxSettings = useMemo(
		() => ({
			repoKey: sandboxRepoKey || undefined,
			taskType: sandboxTaskType,
			promptStrategy: sandboxPromptStrategy,
			timeoutSecondsInput: sandboxTimeoutSecondsInput,
			shouldCommit: sandboxShouldCommit,
		}),
		[
			sandboxRepoKey,
			sandboxTaskType,
			sandboxPromptStrategy,
			sandboxTimeoutSecondsInput,
			sandboxShouldCommit,
		],
	);

	useEffect(() => {
		setSandboxModeSettings(sandboxSettings);
	}, [sandboxSettings, setSandboxModeSettings]);

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
				showHeader={activeModeId !== "council"}
			/>
		);
		const sandboxRequestOptions = {
			sandbox: {
				enabled: true,
				repo: normalisedSandboxRepo || undefined,
				installationId: selectedSandboxRepoOption?.installationId,
				model: selectedModel ?? undefined,
				taskType: sandboxTaskType,
				promptStrategy: sandboxPromptStrategy,
				shouldCommit: isReadOnlySandboxTaskType ? false : sandboxShouldCommit,
				timeoutSeconds: Number.isFinite(parsedSandboxTimeoutSeconds)
					? parsedSandboxTimeoutSeconds
					: undefined,
				maxSteps: 2,
				modelSettings: sandboxModelSettings,
			},
		};
		const sandboxControls = (
			<SandboxChatModeControls
				selectedRepoKey={sandboxRepoKey}
				setSelectedRepoKey={setSandboxRepoKey}
				repoOptions={sandboxRepoOptions}
				normalisedRepo={normalisedSandboxRepo}
				taskType={sandboxTaskType}
				setTaskType={setSandboxTaskType}
				promptStrategy={sandboxPromptStrategy}
				setPromptStrategy={setSandboxPromptStrategy}
				timeoutSecondsInput={sandboxTimeoutSecondsInput}
				setTimeoutSecondsInput={setSandboxTimeoutSecondsInput}
				hasValidTimeout={hasValidSandboxTimeout}
				shouldCommit={sandboxShouldCommit}
				setShouldCommit={setSandboxShouldCommit}
				isReadOnlyTaskType={isReadOnlySandboxTaskType}
				hasConnection={sandboxConnections.length > 0}
				isLoadingRepos={isLoadingSandboxRepos}
				canSaveRepo={canSaveSandboxRepo}
				isSavingRepo={updateSandboxConnectionRepositories.isPending}
				onSaveRepo={handleSaveSandboxRepo}
				showHeader={activeModeId !== "sandbox"}
			/>
		);
		const liveControls = (
			<LiveChatModeControls
				error={liveError}
				lastEvent={liveLastEvent}
				lastTranscript={liveLastTranscript}
				microphoneEnabled={liveMicrophoneEnabled}
				onProviderChange={handleLiveProviderChange}
				onMicrophoneEnabledChange={setLiveMicrophoneEnabled}
				onStart={() => void startLiveSession(effectiveLiveProvider, selectedModel)}
				onStop={stopLiveSessionAndFlush}
				onVideoEnabledChange={setLiveVideoEnabled}
				provider={effectiveLiveProvider}
				showHeader={activeModeId !== "live"}
				showSessionControls={activeModeId !== "live"}
				status={liveStatus}
				videoEnabled={liveVideoEnabled}
			/>
		);
		const liveInputControls = (
			<LiveSessionComposerControls
				error={liveError}
				inputAudioLevel={liveInputAudioLevel}
				lastEvent={liveLastEvent}
				lastTranscript={liveLastTranscript}
				microphoneEnabled={liveMicrophoneEnabled}
				onMicrophoneEnabledChange={setLiveMicrophoneEnabled}
				onStart={() => void startLiveSession(effectiveLiveProvider, selectedModel)}
				onStop={stopLiveSessionAndFlush}
				onVideoEnabledChange={setLiveVideoEnabled}
				outputAudioLevel={liveOutputAudioLevel}
				status={liveStatus}
				videoEnabled={liveVideoEnabled}
				videoSupported={supportsRealtimeLiveVideoInput(effectiveLiveProvider)}
			/>
		);
		const activeModeControls =
			activeModeId === "council"
				? councilControls
				: activeModeId === "sandbox"
					? sandboxControls
					: activeModeId === "live"
						? liveControls
						: undefined;
		const modeControls = {
			activeModeControls,
			commands: HOME_CHAT_MODE_OPTIONS.map((option) => {
				const availability = getHomeChatModeAvailability(option, activeModeId);
				const Icon = option.icon;
				return {
					id: option.id,
					label: option.label,
					description: option.description,
					command: option.id,
					icon: <Icon className="h-4 w-4" aria-hidden="true" />,
					isActive: activeModeId === option.id,
					disabled: availability.disabled,
					disabledReason: availability.reason,
					keepPopoverOpen: option.id === "live",
					onSelect: () => handleModeChange(option.id),
				};
			}),
			onClearActive: activeModeId === "chat" ? undefined : () => handleModeChange("chat"),
		};

		if (activeModeId === "sandbox") {
			return {
				activeModeId,
				modeConfig: {
					analyticsSource: "sandbox",
					welcomeTitle: "What should the sandbox work on?",
					welcomeDescription:
						"Choose repository settings, describe the task, and the normal chat pipeline will run the sandbox tool inside this conversation.",
					welcomeSampleQuestions: [
						{
							id: "sandbox-feature",
							category: "coding",
							text: "Implement a focused feature",
							question: "Implement the smallest maintainable version of the feature we discussed.",
						},
						{
							id: "sandbox-review",
							category: "analytical",
							text: "Review a risky change",
							question:
								"Review the current implementation and report the highest-risk issues first.",
						},
						{
							id: "sandbox-tests",
							category: "technical",
							text: "Add regression coverage",
							question: "Add focused tests for the behaviour that is most likely to regress.",
						},
						{
							id: "sandbox-bug-fix",
							category: "practical",
							text: "Diagnose and fix a bug",
							question:
								"Diagnose the failing path, patch the root cause, and keep the change scoped.",
						},
					],
					inputPlaceholder: {
						newConversation: "Ask the sandbox to implement, review, test, or fix something...",
						followUp: "Ask a follow-up or run another sandbox task...",
					},
					requestOptions: {
						...sandboxRequestOptions,
					},
					modelScope: "text-only",
					conversationMode: buildConversationModeMetadata({
						mode: "sandbox",
						requestOptions: sandboxRequestOptions,
						sandboxSettings,
					}),
					modeControls,
				},
			};
		}

		if (activeModeId === "live") {
			return {
				activeModeId,
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

		if (activeModeId !== "council") {
			return {
				activeModeId,
				modeConfig: {
					modeControls,
					onModelChange: handleModelChange,
				},
			};
		}

		const councilRequestOptions = {
			council: {
				enabled: true,
				responseMode: councilResponseMode,
				memberIds: selectedCouncilMemberIds,
				requireConsensus: true,
			},
		};

		return {
			activeModeId,
			modeConfig: {
				analyticsSource: "council",
				welcomeTitle: "What should the council debate?",
				welcomeDescription:
					"Pick council members, describe the problem, and the backend chat pipeline will run a structured debate before answering.",
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
		activeModeId,
		handleModeChange,
		handleLiveProviderChange,
		handleModelChange,
		selectedCouncilMemberIds,
		councilResponseMode,
		sandboxRepoKey,
		sandboxRepoOptions,
		normalisedSandboxRepo,
		selectedSandboxRepoOption,
		sandboxConnections,
		isLoadingSandboxRepos,
		canSaveSandboxRepo,
		updateSandboxConnectionRepositories.isPending,
		handleSaveSandboxRepo,
		selectedModel,
		sandboxTaskType,
		sandboxPromptStrategy,
		sandboxTimeoutSecondsInput,
		hasValidSandboxTimeout,
		sandboxShouldCommit,
		isReadOnlySandboxTaskType,
		parsedSandboxTimeoutSeconds,
		sandboxModelSettings,
		sandboxSettings,
		liveError,
		liveInputAudioLevel,
		liveMicrophoneEnabled,
		liveVideoEnabled,
		liveLastEvent,
		liveLastTranscript,
		liveOutputAudioLevel,
		liveProvider,
		effectiveLiveProvider,
		composedReasoningModel,
		forceLiveResponseAudio,
		liveStatus,
		liveConversationMode,
		handleFinalLiveInputTranscript,
		setLiveMicrophoneEnabled,
		setLiveVideoEnabled,
		startLiveSession,
		stopLiveSessionAndFlush,
	]);
}
