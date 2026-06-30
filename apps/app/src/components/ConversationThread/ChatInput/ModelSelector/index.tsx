import {
	ChevronDown,
	ChevronUp,
	Cloud,
	Computer,
	Filter,
	Gauge,
	Loader2,
	Search,
	Server,
	WalletCards,
} from "lucide-react";
import {
	type KeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { getAutoRouterModeDefinition } from "~/lib/auto-router-modes";
import { applyModelResponseDefaults } from "~/lib/chat-settings";
import { containsEventTarget } from "~/lib/dom/containsEventTarget";
import { formatTokenCount, formatTokenPrice } from "~/lib/model-formatting";
import {
	createModelReferenceMap,
	defaultModel,
	getAvailableModels,
	getChatAndRealtimeModelsByMode,
	getFeaturedModelIds,
	getModelByReference,
	getModelsByMode,
	getRealtimeSessionModelsByProvider,
	getToolCallModels,
	isModelSelectableForAccount,
	isTextInputChatModel,
	modelSupportsVisualModality,
} from "~/lib/models";
import { getDefaultLiveModelId } from "~/lib/realtime/live-providers";
import { hasProviderReasoningOptions } from "~/lib/reasoning";
import {
	useIsLoading,
	useLoadingMessage,
	useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { ModelConfigItem, ModelModality } from "@assistant/schemas";
import type {
	ChatMode,
	ChatSettings,
	ModelSelectionChangeHandler,
	ModelSelectorScope,
} from "~/types";
import { ArtificialAnalysisScorePanel } from "./ArtificialAnalysisScorePanel";
import { AutoModePicker, getAutoRouterModeIcon } from "./AutoModePicker";
import { clampHoverPreviewTop, getHoverPreviewPosition } from "./hoverPreviewPosition";
import { ModelsList } from "./ModelsList";
import { useHoverPreviewDismiss } from "./useHoverPreviewDismiss";

interface ModelSelectorProps {
	isDisabled?: boolean;
	minimal?: boolean;
	mono?: boolean;
	featuredOnly?: boolean;
	modelProviderFilter?: string;
	modelScope?: ModelSelectorScope;
	onModelChange?: ModelSelectionChangeHandler;
}

interface HoverPreviewState {
	model: ModelConfigItem;
	left: number;
	top: number;
	width: number;
	maxHeight: number;
	anchorTop?: number;
	frameTop?: number;
	frameBottom?: number;
}

interface DialogLayout {
	left: number;
	width: number;
}

function HoverPreview({
	preview,
	containerRef,
	onMouseEnter,
	onDismiss,
}: {
	preview: HoverPreviewState | null;
	containerRef: RefObject<HTMLDivElement | null>;
	onMouseEnter: () => void;
	onDismiss: () => void;
}) {
	const [measuredTop, setMeasuredTop] = useState<number | null>(null);

	useLayoutEffect(() => {
		setMeasuredTop(null);
	}, [preview]);

	useLayoutEffect(() => {
		if (
			preview?.frameTop === undefined ||
			preview.frameBottom === undefined ||
			preview.anchorTop === undefined
		) {
			return;
		}
		const element = containerRef.current;
		if (!element) {
			return;
		}

		const nextTop = clampHoverPreviewTop({
			anchorTop: preview.anchorTop,
			previewHeight: element.getBoundingClientRect().height,
			frameTop: preview.frameTop,
			frameBottom: preview.frameBottom,
		});
		setMeasuredTop((currentTop) => (currentTop === nextTop ? currentTop : nextTop));
	}, [containerRef, measuredTop, preview]);

	if (!preview) return null;

	const model = preview.model;
	const top = measuredTop ?? preview.top;
	const maxHeight =
		preview.frameBottom !== undefined ? preview.frameBottom - top : preview.maxHeight;

	const featureTags = Array.from(
		new Set(
			[
				model.supportsToolCalls ? "Tool Calling" : null,
				hasProviderReasoningOptions(model) ? "Reasoning" : null,
				model.supportsSearchGrounding ? "Web Grounding" : null,
				model.supportsCodeExecution ? "Code Execution" : null,
				model.supportsAudio ? "Audio" : null,
				modelSupportsVisualModality(model) ? "Vision" : null,
				...(model.strengths || []),
			].filter(Boolean) as string[],
		),
	);

	return (
		<div
			ref={containerRef}
			style={{
				top,
				left: preview.left,
				width: preview.width,
				maxHeight,
			}}
			role="tooltip"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onDismiss}
			className="fixed z-[70] overflow-y-auto rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-2xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95"
		>
			<div className="mb-3 rounded-lg border border-zinc-200/70 p-3 dark:border-zinc-700/70">
				<div className="flex items-center gap-2">
					<ModelIcon
						url={model.avatarUrl}
						modelName={model.name || model.matchingModel}
						provider={model.provider}
						size={28}
					/>
					<div className="min-w-0">
						<p className="font-semibold text-zinc-900 whitespace-normal break-words dark:text-zinc-100">
							{model.name || model.matchingModel}
						</p>
						<p className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-normal break-words">
							{model.provider}
						</p>
					</div>
				</div>
				{model.description && (
					<p className="mt-2 text-xs text-zinc-600 whitespace-normal break-words dark:text-zinc-300">
						{model.description}
					</p>
				)}

				{featureTags.length > 0 && (
					<div className="mt-3">
						<p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
							Features
						</p>
						<div className="flex flex-wrap gap-1">
							{featureTags.map((feature) => (
								<span
									key={`${model.id}-${feature}`}
									className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
								>
									{feature}
								</span>
							))}
						</div>
					</div>
				)}
			</div>

			<div className="space-y-2 text-xs">
				<div className="rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-700/70">
					<div className="mb-1 flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
						<Gauge className="h-3.5 w-3.5" />
						<span className="font-semibold">Capacity</span>
					</div>
					<div className="space-y-1">
						{model.contextWindow && (
							<div className="flex items-center justify-between gap-2">
								<span className="text-zinc-500 dark:text-zinc-400">Context Window</span>
								<span className="text-right font-medium text-zinc-800 dark:text-zinc-100">
									{formatTokenCount(model.contextWindow)} tokens
								</span>
							</div>
						)}
						{model.maxTokens && (
							<div className="flex items-center justify-between gap-2">
								<span className="text-zinc-500 dark:text-zinc-400">Max Output</span>
								<span className="text-right font-medium text-zinc-800 dark:text-zinc-100">
									{formatTokenCount(model.maxTokens)} tokens
								</span>
							</div>
						)}
					</div>
				</div>

				{(typeof model.costPer1kInputTokens === "number" ||
					typeof model.costPer1kOutputTokens === "number") && (
					<div className="rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-700/70">
						<div className="mb-1 flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
							<WalletCards className="h-3.5 w-3.5" />
							<span className="font-semibold">Pricing</span>
						</div>
						<div className="space-y-1">
							{typeof model.costPer1kInputTokens === "number" && (
								<div className="flex items-center justify-between gap-2">
									<span className="text-zinc-500 dark:text-zinc-400">Input</span>
									<span className="text-right font-medium text-zinc-800 dark:text-zinc-100">
										{formatTokenPrice(model.costPer1kInputTokens)}
									</span>
								</div>
							)}
							{typeof model.costPer1kOutputTokens === "number" && (
								<div className="flex items-center justify-between gap-2">
									<span className="text-zinc-500 dark:text-zinc-400">Output</span>
									<span className="text-right font-medium text-zinc-800 dark:text-zinc-100">
										{formatTokenPrice(model.costPer1kOutputTokens)}
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				{model.artificialAnalysis ? (
					<ArtificialAnalysisScorePanel analysis={model.artificialAnalysis} />
				) : null}
			</div>
		</div>
	);
}

export const ModelSelector = ({
	isDisabled,
	minimal = false,
	mono = false,
	featuredOnly = false,
	modelProviderFilter,
	modelScope = "default",
	onModelChange,
}: ModelSelectorProps) => {
	const { trackEvent } = useTrackEvent();
	const { isMobile } = useUIStore();
	const {
		isPro,
		model,
		setModel,
		autoMode,
		setAutoMode,
		chatMode,
		setChatMode,
		chatSettings,
		setChatSettings,
		selectedAgentId,
		setSelectedAgentId,
	} = useChatStore();
	const { chatAgents: agents } = useAgents();
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCapability, setSelectedCapability] = useState<ModelModality | null>(null);
	const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
	const [dialogLayout, setDialogLayout] = useState<DialogLayout | null>(null);
	const isTextOnlyScope = modelScope === "text-only";
	const isLiveScope = modelScope === "live";
	const isChatAndLiveScope = modelScope === "chat-and-live";
	const isModelListOnlyScope = isTextOnlyScope || isLiveScope || isChatAndLiveScope;

	const dropdownRef = useRef<HTMLDivElement>(null);
	const triggerWrapperRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const hoverPreviewRef = useRef<HTMLDivElement | null>(null);
	const [selectedTab, setSelectedTab] = useState<"auto" | "models">(() => {
		if (isModelListOnlyScope) return "models";
		if (model === null) return "auto";
		return "models";
	});

	const automaticModelOption: ModelConfigItem = {
		id: "auto",
		matchingModel: "auto",
		name: "Automatic",
		provider: "System",
		modalities: { input: ["text"], output: ["text"] },
		strengths: [],
		isFree: true,
	};

	const { data: apiModels = {}, isLoading: isLoadingModels } = useModels();
	const webLLMModels = useWebLLMModels();
	const isModelLoading = useIsLoading("model-init");
	const modelLoadingProgress = useLoadingProgress("model-init");
	const modelLoadingMessage = useLoadingMessage("model-init");

	const availableModels = useMemo(
		() => getAvailableModels(apiModels, true, webLLMModels),
		[apiModels, webLLMModels],
	);
	const functionModels = useMemo(() => getToolCallModels(availableModels), [availableModels]);
	const featuredModelIds = useMemo(() => getFeaturedModelIds(availableModels), [availableModels]);

	const modelListChatMode = isModelListOnlyScope && chatMode === "agent" ? "remote" : chatMode;
	const baseFilteredModels = useMemo(
		() =>
			isLiveScope
				? getRealtimeSessionModelsByProvider(availableModels, modelProviderFilter)
				: isChatAndLiveScope
					? getChatAndRealtimeModelsByMode(availableModels, modelListChatMode)
					: !isTextOnlyScope && chatMode === "agent"
						? functionModels
						: getModelsByMode(availableModels, modelListChatMode),
		[
			availableModels,
			chatMode,
			functionModels,
			isChatAndLiveScope,
			isLiveScope,
			isTextOnlyScope,
			modelListChatMode,
			modelProviderFilter,
		],
	);

	const filteredModels = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(baseFilteredModels).filter(
					([id, modelConfig]) =>
						(!featuredOnly || Boolean(featuredModelIds[id])) &&
						(!isTextOnlyScope || isTextInputChatModel(modelConfig)),
				),
			),
		[baseFilteredModels, featuredModelIds, featuredOnly, isTextOnlyScope],
	);

	const filteredModelReferences = useMemo(
		() => createModelReferenceMap(filteredModels),
		[filteredModels],
	);
	const selectedAutoMode = getAutoRouterModeDefinition(autoMode);
	const SelectedAutoModeIcon = getAutoRouterModeIcon(selectedAutoMode.id);
	const selectedAutoModeDisplayName =
		selectedAutoMode.id === "auto" ? selectedAutoMode.label : `${selectedAutoMode.label} auto`;
	const selectedModelInfo =
		model === null ? automaticModelOption : getModelByReference(filteredModelReferences, model);

	const capabilities = useMemo(
		() =>
			Array.from(
				new Set(
					Object.values(filteredModels).flatMap((modelConfig) => modelConfig.strengths || []),
				),
			).sort(),
		[filteredModels],
	);

	const filteredModelList = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		return Object.values(filteredModels).filter((modelConfig) => {
			const matchesSearch =
				normalizedQuery.length === 0 ||
				(modelConfig.name || modelConfig.matchingModel).toLowerCase().includes(normalizedQuery) ||
				(modelConfig.description || "").toLowerCase().includes(normalizedQuery) ||
				(modelConfig.provider || "").toLowerCase().includes(normalizedQuery);

			const matchesCapability =
				!selectedCapability || Boolean(modelConfig.strengths?.includes(selectedCapability));

			return matchesSearch && matchesCapability;
		});
	}, [filteredModels, searchQuery, selectedCapability]);
	const autoModeModels = useMemo(
		() =>
			Object.values(getModelsByMode(availableModels, "remote")).filter((modelConfig) =>
				isModelSelectableForAccount(modelConfig, isPro),
			),
		[availableModels, isPro],
	);
	const isModelSearchActive = searchQuery.trim().length > 0;

	const getSettingsForModel = useCallback(
		(nextModel: string | null, settings: ChatSettings) =>
			applyModelResponseDefaults(settings, nextModel ? availableModels[nextModel] : undefined),
		[availableModels],
	);

	const selectModelWithDefaults = useCallback(
		(nextModel: string | null, settings: ChatSettings = chatSettings) => {
			setModel(nextModel);
			setChatSettings(getSettingsForModel(nextModel, settings));
		},
		[chatSettings, getSettingsForModel, setChatSettings, setModel],
	);

	useEffect(() => {
		if (!isModelListOnlyScope) {
			return;
		}

		if (chatMode === "agent") {
			setChatMode("remote");
			setSelectedAgentId(null);
		}

		if (selectedTab !== "models") {
			setSelectedTab("models");
		}

		if (model && getModelByReference(filteredModelReferences, model)) {
			return;
		}

		const defaultScopedModel =
			isLiveScope && modelProviderFilter
				? getDefaultLiveModelId(modelProviderFilter)
				: defaultModel;
		const fallbackModel = filteredModels[defaultScopedModel]
			? defaultScopedModel
			: filteredModels[defaultModel]
				? defaultModel
				: Object.keys(filteredModels)[0];
		if (fallbackModel) {
			selectModelWithDefaults(fallbackModel, {
				...chatSettings,
				localOnly: modelListChatMode === "local",
			});
		}
	}, [
		chatMode,
		chatSettings,
		filteredModels,
		filteredModelReferences,
		isLiveScope,
		isModelListOnlyScope,
		model,
		modelProviderFilter,
		modelListChatMode,
		selectModelWithDefaults,
		selectedTab,
		setChatMode,
		setSelectedAgentId,
	]);

	const clearHoverPreview = useCallback(() => setHoverPreview(null), []);
	const {
		cancelDismiss: cancelHoverPreviewDismiss,
		dismiss: dismissHoverPreview,
		scheduleDismiss: scheduleHoverPreviewDismiss,
	} = useHoverPreviewDismiss(clearHoverPreview, hoverPreviewRef);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const isInsideSelector =
				containsEventTarget(dropdownRef.current, event.target) ||
				containsEventTarget(triggerWrapperRef.current, event.target) ||
				containsEventTarget(hoverPreviewRef.current, event.target);
			if (!isInsideSelector) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		if (isOpen) return;
		dismissHoverPreview();
	}, [dismissHoverPreview, isOpen]);

	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Escape") {
			setIsOpen(false);
			return;
		}
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const items = dropdownRef.current?.querySelectorAll(
				'[role="option"]:not([aria-disabled="true"])',
			);
			if (!items?.length) return;
			const list = Array.from(items) as HTMLElement[];
			const active = document.activeElement as HTMLElement;
			const idx = list.indexOf(active);
			let next = 0;
			if (e.key === "ArrowDown") next = idx < list.length - 1 ? idx + 1 : 0;
			else next = idx > 0 ? idx - 1 : list.length - 1;
			list[next].focus();
		}
	};

	useEffect(() => {
		if (!isOpen) return;
		if (!isMobile && searchInputRef.current) {
			searchInputRef.current.focus();
			return;
		}
		const firstOpt = dropdownRef.current?.querySelector('[role="option"]');
		(firstOpt as HTMLElement | null)?.focus();
	}, [isOpen, isMobile]);

	useEffect(() => {
		if (!isOpen) {
			setDialogLayout(null);
			return;
		}

		const updateDialogLayout = () => {
			const wrapper = triggerWrapperRef.current;
			if (!wrapper) return;

			const chatInputShell = wrapper.closest("[data-chat-input-shell]");
			if (!(chatInputShell instanceof HTMLElement)) {
				setDialogLayout(null);
				return;
			}

			const shellRect = chatInputShell.getBoundingClientRect();
			const wrapperRect = wrapper.getBoundingClientRect();
			const maxWidth = Math.min(660, shellRect.width);

			setDialogLayout({
				left: shellRect.left - wrapperRect.left,
				width: maxWidth,
			});
		};

		updateDialogLayout();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateDialogLayout);
			return () => window.removeEventListener("resize", updateDialogLayout);
		}

		const observer = new ResizeObserver(updateDialogLayout);
		const wrapper = triggerWrapperRef.current;
		const chatInputShell = wrapper?.closest("[data-chat-input-shell]");
		if (wrapper) observer.observe(wrapper);
		if (chatInputShell instanceof HTMLElement) observer.observe(chatInputShell);
		window.addEventListener("resize", updateDialogLayout);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateDialogLayout);
		};
	}, [isOpen]);

	const handleToggleModelSource = (newChatMode: ChatMode) => {
		setChatMode(newChatMode);

		if (newChatMode === "local") {
			const nextSettings = {
				...chatSettings,
				localOnly: true,
			};
			selectModelWithDefaults("", nextSettings);
		} else {
			const nextSettings = {
				...chatSettings,
				localOnly: false,
			};
			selectModelWithDefaults(defaultModel, nextSettings);
		}

		if (newChatMode !== "agent") {
			setSelectedAgentId(null);
		}

		trackEvent({
			name: "set_model_source",
			category: "conversation",
			label: "model_source",
			value: newChatMode,
		});
	};

	const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
	const isModelLockedByAgent = Boolean(selectedAgent?.model);

	const currentAgentModel = selectedAgentId
		? agents.find((agent) => agent.id === selectedAgentId)?.model
		: null;

	useEffect(() => {
		if (chatMode === "agent" && currentAgentModel !== undefined && currentAgentModel !== model) {
			selectModelWithDefaults(currentAgentModel);
		}
	}, [currentAgentModel, model, selectModelWithDefaults, chatMode]);

	if (isLoadingModels) {
		return (
			<div className="flex items-center gap-2 text-sm text-zinc-500">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading models...
			</div>
		);
	}

	const handleModelChange = (newModel: string) => {
		selectModelWithDefaults(newModel);
		onModelChange?.(newModel, availableModels[newModel]);

		trackEvent({
			name: "set_model",
			category: "conversation",
			label: "select_model",
			value: newModel,
		});
	};

	const handleInfoHoverStart = (modelInfo: ModelConfigItem, anchorRect: DOMRect) => {
		cancelHoverPreviewDismiss();

		if (!isOpen) {
			dismissHoverPreview();
			return;
		}

		const position = getHoverPreviewPosition(
			anchorRect,
			dropdownRef.current?.getBoundingClientRect(),
		);
		if (!position) {
			dismissHoverPreview();
			return;
		}

		setHoverPreview({
			model: modelInfo,
			...position,
		});
	};

	const handleInfoHoverEnd = () => {
		scheduleHoverPreviewDismiss();
	};

	const handleSelectAutoMode = (nextAutoMode: typeof autoMode) => {
		setChatMode("remote");
		setSelectedAgentId(null);
		setAutoMode(nextAutoMode);
		selectModelWithDefaults(null, {
			...chatSettings,
			localOnly: false,
		});
		onModelChange?.(null);
		setIsOpen(false);

		trackEvent({
			name: "set_auto_mode",
			category: "conversation",
			label: "select_auto_mode",
			value: nextAutoMode,
		});
	};

	return (
		<div ref={triggerWrapperRef} className="relative">
			<button
				type="button"
				onClick={() => {
					const opening = !isOpen;
					if (opening) {
						if (isModelListOnlyScope) {
							setSelectedTab("models");
						} else if (model === null) {
							setSelectedTab("auto");
						} else {
							setSelectedTab("models");
						}
					}
					setIsOpen(opening);
				}}
				disabled={isDisabled}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-label="Select a model"
				className={`cursor-pointer disabled:cursor-not-allowed flex items-center gap-2 rounded-md w-full ${minimal ? "px-2 py-1" : "px-3 py-1.5"} bg-off-white-highlight dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors`}
			>
				{isModelLoading ? (
					<div className="flex items-center gap-2 w-full min-w-0">
						<Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
						{!minimal && (
							<span
								className="text-sm max-w-[250px] truncate w-full"
								title={selectedModelInfo?.name || "Select model"}
							>
								{modelLoadingMessage}{" "}
								{modelLoadingProgress !== undefined && `(${modelLoadingProgress}%)`}
							</span>
						)}
					</div>
				) : (
					<>
						{model === null ? (
							<span
								className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center"
								role="img"
								aria-label={`${selectedAutoMode.label} automatic mode icon`}
							>
								<SelectedAutoModeIcon className="h-4 w-4" aria-hidden="true" />
							</span>
						) : (
							<ModelIcon
								modelName={selectedModelInfo?.name || ""}
								provider={selectedModelInfo?.provider}
								size={18}
								mono={mono}
							/>
						)}
						{!minimal && (
							<span
								className="text-sm max-w-[250px] truncate w-full"
								title={
									selectedAgent && chatMode === "agent"
										? `${selectedAgent.name} - ${selectedModelInfo?.name || "Model"}`
										: isModelLockedByAgent
											? `${selectedModelInfo?.name || "Model"} (set by agent)`
											: model === null
												? selectedAutoModeDisplayName
												: selectedModelInfo?.name || "Select model"
								}
							>
								{selectedAgent && chatMode === "agent"
									? `${selectedAgent.name} - ${selectedModelInfo?.name || "Model"}`
									: model === null
										? selectedAutoModeDisplayName
										: selectedModelInfo?.name || "Select model"}
								{isModelLockedByAgent && !selectedAgent && " (set by agent)"}
							</span>
						)}
					</>
				)}
				{isOpen ? (
					<ChevronUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
				) : (
					<ChevronDown className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
				)}
			</button>

			{isOpen && (
				<div
					ref={dropdownRef}
					onKeyDown={handleKeyDown}
					role="dialog"
					tabIndex={-1}
					aria-modal="false"
					style={
						dialogLayout
							? {
									left: `${dialogLayout.left}px`,
									width: `${dialogLayout.width}px`,
								}
							: undefined
					}
					className="absolute bottom-full left-0 z-50 mb-1 flex max-h-[70vh] w-[min(96vw,600px)] max-w-[600px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-off-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[75vh] sm:w-[min(90vw,660px)] sm:max-w-[660px]"
					aria-label="Model selection dialog"
				>
					{selectedTab === "models" && (
						<div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
							<div className="flex flex-col gap-2 sm:flex-row">
								<div className="relative flex-1">
									<input
										ref={searchInputRef}
										placeholder="Search models..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="w-full rounded-md border border-zinc-200 bg-off-white py-2 pl-8 pr-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
										aria-label="Search models"
									/>
									<Search
										className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
										aria-hidden="true"
									/>
								</div>
								<div className="relative sm:w-48">
									<select
										value={selectedCapability || ""}
										onChange={(e) => {
											const nextCapability =
												capabilities.find((capability) => capability === e.target.value) ?? null;
											setSelectedCapability(nextCapability);
										}}
										className="w-full appearance-none rounded-md border border-zinc-200 bg-off-white py-2 pl-8 pr-3 text-sm text-zinc-900 focus:border-zinc-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
										aria-label="Filter by model type"
									>
										<option value="">All model types</option>
										{capabilities.map((capability) => (
											<option key={capability} value={capability}>
												{capability}
											</option>
										))}
									</select>
									<Filter
										className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
										aria-hidden="true"
									/>
								</div>
							</div>
						</div>
					)}

					<Tabs
						value={selectedTab}
						onValueChange={(value) => {
							const tab = value as "auto" | "models";
							if (isModelListOnlyScope && tab !== "models") {
								return;
							}
							setSelectedTab(tab);
							if (tab === "auto") {
								setChatMode("remote");
								setSelectedAgentId(null);
								selectModelWithDefaults(null, {
									...chatSettings,
									localOnly: false,
								});
								onModelChange?.(null);
							} else if (tab === "models" && model === null) {
								setChatMode("remote");
								setSelectedAgentId(null);
								const nextSettings = {
									...chatSettings,
									localOnly: false,
								};
								selectModelWithDefaults(defaultModel, nextSettings);
							}
						}}
						className="min-h-0 flex-1 px-2 pb-2 pt-2"
					>
						{!isModelListOnlyScope && (
							<>
								<TabsList className="grid h-auto w-full grid-cols-2 gap-1">
									<TabsTrigger value="auto" className="min-w-0 px-2 py-2 text-xs sm:text-sm">
										<Gauge className="h-4 w-4" />
										Auto
									</TabsTrigger>
									<TabsTrigger value="models" className="min-w-0 px-2 py-2 text-xs sm:text-sm">
										<Server className="h-4 w-4" />
										Models
									</TabsTrigger>
								</TabsList>
								<div className="w-full border-b border-zinc-200 dark:border-zinc-700" />

								<TabsContent value="auto" className="min-h-0 overflow-y-auto">
									<AutoModePicker
										models={autoModeModels}
										selectedMode={autoMode}
										disabled={isDisabled || isModelLockedByAgent}
										onSelectMode={handleSelectAutoMode}
									/>
								</TabsContent>
							</>
						)}

						<TabsContent value="models" className="flex min-h-0 flex-col overflow-hidden">
							<div className="flex min-h-0 flex-1 flex-col gap-3">
								{!isLiveScope && (
									<div>
										<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
											<div className="text-xs text-zinc-500 dark:text-zinc-400">Model Source:</div>
											<div className="inline-flex items-center rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
												<button
													type="button"
													className={`cursor-pointer flex items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
														chatMode === "remote"
															? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
															: "text-zinc-600 dark:text-zinc-400"
													}`}
													onClick={() => chatMode !== "remote" && handleToggleModelSource("remote")}
													aria-pressed={chatMode === "remote"}
												>
													<Cloud className="h-3 w-3" />
													Remote
												</button>
												<button
													type="button"
													className={`cursor-pointer flex items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
														chatMode === "local"
															? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
															: "text-zinc-600 dark:text-zinc-400"
													}`}
													onClick={() => chatMode !== "local" && handleToggleModelSource("local")}
													aria-pressed={chatMode === "local"}
												>
													<Computer className="h-3 w-3" />
													Local
												</button>
											</div>
										</div>
									</div>
								)}

								<ModelsList
									disabled={isModelLockedByAgent}
									models={filteredModelList}
									featuredModelIds={featuredModelIds}
									isDisabled={isDisabled}
									isPro={isPro}
									selectedId={selectedModelInfo?.id}
									onSelect={(id) => {
										handleModelChange(id);
										setIsOpen(false);
									}}
									mono={mono}
									isSearchActive={isModelSearchActive}
									onInfoHoverStart={handleInfoHoverStart}
									onInfoHoverEnd={handleInfoHoverEnd}
								/>
							</div>
						</TabsContent>
					</Tabs>
				</div>
			)}
			<HoverPreview
				preview={hoverPreview}
				containerRef={hoverPreviewRef}
				onMouseEnter={cancelHoverPreviewDismiss}
				onDismiss={handleInfoHoverEnd}
			/>
		</div>
	);
};
