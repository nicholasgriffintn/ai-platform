import {
	Bot,
	Cloud,
	Computer,
	Filter,
	Gauge,
	Loader2,
	Search,
	Server,
	WalletCards,
	Wand2,
} from "lucide-react";
import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAgentToolDefaults } from "~/hooks/useAgentToolDefaults";
import { useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
	defaultModel,
	getAvailableModels,
	getFeaturedModelIds,
	getModelsByMode,
} from "~/lib/models";
import {
	useIsLoading,
	useLoadingMessage,
	useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { ChatMode, ModelConfigItem } from "~/types";
import { ModelOption } from "./ModelOption";
import { ModelsList } from "./ModelsList";

interface ModelSelectorProps {
	isDisabled?: boolean;
	minimal?: boolean;
	mono?: boolean;
	featuredOnly?: boolean;
}

interface HoverPreviewState {
	model: ModelConfigItem;
	left: number;
	top: number;
}

const HOVER_PREVIEW_WIDTH = 320;
const HOVER_PREVIEW_HEIGHT = 460;
const HOVER_PREVIEW_GUTTER = 12;
const HOVER_PREVIEW_EDGE = 8;

function formatTokenCount(value?: number) {
	if (!value) return null;
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
	return String(value);
}

function formatCost(value?: number) {
	if (typeof value !== "number") return null;
	if (value === 0) return "$0 / 1K tokens";
	if (value < 0.01) return `$${value.toFixed(4)} / 1K tokens`;
	return `$${value.toFixed(2)} / 1K tokens`;
}

function getHoverPreviewPosition(anchorRect: DOMRect) {
	if (typeof window === "undefined" || window.innerWidth < 1024) {
		return null;
	}

	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	let left = anchorRect.right + HOVER_PREVIEW_GUTTER;

	if (left + HOVER_PREVIEW_WIDTH > viewportWidth - HOVER_PREVIEW_EDGE) {
		left = anchorRect.left - HOVER_PREVIEW_WIDTH - HOVER_PREVIEW_GUTTER;
	}

	const cannotFitHorizontally =
		left < HOVER_PREVIEW_EDGE ||
		left + HOVER_PREVIEW_WIDTH > viewportWidth - HOVER_PREVIEW_EDGE;
	if (cannotFitHorizontally) {
		return null;
	}

	const top = Math.min(
		Math.max(anchorRect.top - 40, HOVER_PREVIEW_EDGE),
		Math.max(
			HOVER_PREVIEW_EDGE,
			viewportHeight - HOVER_PREVIEW_HEIGHT - HOVER_PREVIEW_EDGE,
		),
	);

	return { left, top };
}

function HoverPreview({ preview }: { preview: HoverPreviewState | null }) {
	if (!preview) return null;

	const model = preview.model;
	const supportsVision =
		model.modalities?.input?.some((modality) =>
			["image", "video"].includes(modality),
		) ||
		model.modalities?.output?.some((modality) =>
			["image", "video"].includes(modality),
		);

	const featureTags = Array.from(
		new Set(
			[
				model.supportsToolCalls ? "Tool Calling" : null,
				model.reasoningConfig?.enabled ? "Reasoning" : null,
				model.supportsSearchGrounding ? "Web Grounding" : null,
				model.supportsCodeExecution ? "Code Execution" : null,
				model.supportsAudio ? "Audio" : null,
				model.multimodal || supportsVision ? "Vision" : null,
				...(model.strengths || []),
			].filter(Boolean) as string[],
		),
	);

	return (
		<div
			style={{ top: preview.top, left: preview.left }}
			className="pointer-events-none fixed z-[70] hidden w-[320px] max-h-[70vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-2xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95 lg:block"
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
			</div>

			{featureTags.length > 0 && (
				<div className="mb-3">
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

			<div className="space-y-2 text-xs">
				<div className="rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-700/70">
					<div className="mb-1 flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
						<Gauge className="h-3.5 w-3.5" />
						<span className="font-semibold">Capacity</span>
					</div>
					<div className="space-y-1">
						{model.contextWindow && (
							<div className="flex items-center justify-between gap-2">
								<span className="text-zinc-500 dark:text-zinc-400">
									Context Window
								</span>
								<span className="text-right font-medium text-zinc-800 dark:text-zinc-100">
									{formatTokenCount(model.contextWindow)} tokens
								</span>
							</div>
						)}
						{model.maxTokens && (
							<div className="flex items-center justify-between gap-2">
								<span className="text-zinc-500 dark:text-zinc-400">
									Max Output
								</span>
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
									<span className="text-zinc-500 dark:text-zinc-400">
										Input
									</span>
									<span className="text-right font-medium text-zinc-800 dark:text-zinc-100">
										{formatCost(model.costPer1kInputTokens)}
									</span>
								</div>
							)}
							{typeof model.costPer1kOutputTokens === "number" && (
								<div className="flex items-center justify-between gap-2">
									<span className="text-zinc-500 dark:text-zinc-400">
										Output
									</span>
									<span className="text-right font-medium text-zinc-800 dark:text-zinc-100">
										{formatCost(model.costPer1kOutputTokens)}
									</span>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export const ModelSelector = ({
	isDisabled,
	minimal = false,
	mono = false,
	featuredOnly = false,
}: ModelSelectorProps) => {
	const { trackEvent } = useTrackEvent();
	const { isMobile } = useUIStore();
	const {
		isPro,
		model,
		setModel,
		chatMode,
		setChatMode,
		chatSettings,
		setChatSettings,
		selectedAgentId,
		setSelectedAgentId,
	} = useChatStore();
	const { chatAgents: agents, isLoadingAgents } = useAgents();
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCapability, setSelectedCapability] = useState<string | null>(
		null,
	);
	const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
		null,
	);

	const dropdownRef = useRef<HTMLDialogElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [selectedTab, setSelectedTab] = useState<"auto" | "agent" | "models">(
		() => {
			if (model === null) return "auto";
			if (chatMode === "agent") return "agent";
			return "models";
		},
	);

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
	const isModelLoading = useIsLoading("model-init");
	const modelLoadingProgress = useLoadingProgress("model-init");
	const modelLoadingMessage = useLoadingMessage("model-init");

	const availableModels = getAvailableModels(apiModels);
	const functionModels: Record<string, ModelConfigItem> = Object.entries(
		availableModels,
	).reduce(
		(acc, [key, modelConfig]) => {
			if (modelConfig.supportsToolCalls) {
				acc[key] = { ...modelConfig, id: key };
			}
			return acc;
		},
		{} as Record<string, ModelConfigItem>,
	);
	const featuredModelIds = getFeaturedModelIds(availableModels);

	const baseFilteredModels =
		chatMode === "agent"
			? functionModels
			: getModelsByMode(availableModels, chatMode);

	const filteredModels = featuredOnly
		? Object.fromEntries(
				Object.entries(baseFilteredModels).filter(([id]) =>
					Boolean(featuredModelIds[id]),
				),
			)
		: baseFilteredModels;

	const selectedModelInfo =
		model === null ? automaticModelOption : filteredModels[model];

	const capabilities = useMemo(
		() =>
			Array.from(
				new Set(
					Object.values(filteredModels).flatMap(
						(modelConfig) => modelConfig.strengths || [],
					),
				),
			).sort(),
		[filteredModels],
	);

	const filteredModelList = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		return Object.values(filteredModels).filter((modelConfig) => {
			const matchesSearch =
				normalizedQuery.length === 0 ||
				(modelConfig.name || modelConfig.matchingModel)
					.toLowerCase()
					.includes(normalizedQuery) ||
				(modelConfig.description || "")
					.toLowerCase()
					.includes(normalizedQuery) ||
				(modelConfig.provider || "").toLowerCase().includes(normalizedQuery);

			const matchesCapability =
				!selectedCapability ||
				Boolean(modelConfig.strengths?.includes(selectedCapability));

			return matchesSearch && matchesCapability;
		});
	}, [filteredModels, searchQuery, selectedCapability]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		if (isOpen) return;
		setHoverPreview(null);
	}, [isOpen]);

	useEffect(() => {
		const clearPreview = () => setHoverPreview(null);
		window.addEventListener("resize", clearPreview);
		window.addEventListener("scroll", clearPreview, true);
		return () => {
			window.removeEventListener("resize", clearPreview);
			window.removeEventListener("scroll", clearPreview, true);
		};
	}, []);

	const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
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

	const handleToggleModelSource = (newChatMode: ChatMode) => {
		setChatMode(newChatMode);

		if (newChatMode === "local") {
			setChatSettings({
				...chatSettings,
				localOnly: true,
			});
			setModel("");
		} else {
			setChatSettings({
				...chatSettings,
				localOnly: false,
			});
			setModel(defaultModel);
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

	useAgentToolDefaults({
		agents,
		selectedAgentId,
		chatMode,
	});

	const currentAgentModel = selectedAgentId
		? agents.find((agent) => agent.id === selectedAgentId)?.model
		: null;

	useEffect(() => {
		if (
			chatMode === "agent" &&
			currentAgentModel !== undefined &&
			currentAgentModel !== model
		) {
			setModel(currentAgentModel);
		}
	}, [currentAgentModel, model, setModel, chatMode]);

	if (isLoadingModels) {
		return (
			<div className="flex items-center gap-2 text-sm text-zinc-500">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading models...
			</div>
		);
	}

	const handleModelChange = (newModel: string) => {
		setModel(newModel);

		trackEvent({
			name: "set_model",
			category: "conversation",
			label: "select_model",
			value: newModel,
		});
	};

	const handleInfoHoverStart = (
		modelInfo: ModelConfigItem,
		anchorRect: DOMRect,
	) => {
		if (isMobile || !isOpen) {
			setHoverPreview(null);
			return;
		}

		const position = getHoverPreviewPosition(anchorRect);
		if (!position) {
			setHoverPreview(null);
			return;
		}

		setHoverPreview({
			model: modelInfo,
			...position,
		});
	};

	const handleInfoHoverEnd = () => {
		setHoverPreview(null);
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => {
					const opening = !isOpen;
					if (opening) {
						if (model === null) {
							setSelectedTab("auto");
						} else if (chatMode === "agent") {
							setSelectedTab("agent");
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
								{modelLoadingProgress !== undefined &&
									`(${modelLoadingProgress}%)`}
							</span>
						)}
					</div>
				) : (
					<>
						<ModelIcon
							modelName={selectedModelInfo?.name || ""}
							provider={selectedModelInfo?.provider}
							size={18}
							mono={mono}
						/>
						{!minimal && (
							<span
								className="text-sm max-w-[250px] truncate w-full"
								title={
									selectedAgent && chatMode === "agent"
										? `${selectedAgent.name} - ${selectedModelInfo?.name || "Model"}`
										: isModelLockedByAgent
											? `${selectedModelInfo?.name || "Model"} (set by agent)`
											: selectedModelInfo?.name || "Select model"
								}
							>
								{selectedAgent && chatMode === "agent"
									? `${selectedAgent.name} - ${selectedModelInfo?.name || "Model"}`
									: selectedModelInfo?.name || "Select model"}
								{isModelLockedByAgent && !selectedAgent && " (set by agent)"}
							</span>
						)}
					</>
				)}
			</button>

			{isOpen && (
				<dialog
					ref={dropdownRef}
					open
					onKeyDown={handleKeyDown}
					className="absolute bottom-full left-0 z-50 mb-1 w-[min(94vw,660px)] max-w-[660px] rounded-xl border border-zinc-200 bg-off-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
					aria-label="Model selection dialog"
				>
					{selectedTab !== "auto" && (
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
										onChange={(e) =>
											setSelectedCapability(e.target.value || null)
										}
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
							const tab = value as "auto" | "agent" | "models";
							setSelectedTab(tab);
							if (tab === "auto") {
								setChatMode("remote");
								setModel(null);
								setSelectedAgentId(null);
								setChatSettings({
									...chatSettings,
									localOnly: false,
								});
							} else if (tab === "agent") {
								setChatMode("agent");
								setModel(defaultModel);
								setSelectedAgentId(null);
								setChatSettings({
									...chatSettings,
									localOnly: false,
								});
							} else if (tab === "models") {
								setChatMode("remote");
								setModel(defaultModel);
								setSelectedAgentId(null);
								setChatSettings({
									...chatSettings,
									localOnly: false,
								});
							}
						}}
						className="px-2 pb-2 pt-2"
					>
						<TabsList className="w-full">
							<TabsTrigger value="auto">
								<Wand2 className="h-4 w-4" />
								Automatic
							</TabsTrigger>
							<TabsTrigger value="agent">
								<Bot className="h-4 w-4" />
								Agents
							</TabsTrigger>
							<TabsTrigger value="models">
								<Server className="h-4 w-4" />
								Models
							</TabsTrigger>
						</TabsList>
						<div className="w-full border-b border-zinc-200 dark:border-zinc-700" />

						<TabsContent value="auto">
							<div className="p-4 text-sm text-zinc-700 dark:text-zinc-300">
								Automatic automatically selects the best agent or model based on
								your query.
							</div>
						</TabsContent>

						<TabsContent value="agent">
							<div className="space-y-3 pt-2">
								<div className="max-h-[140px] overflow-y-auto rounded-lg border border-zinc-200/70 p-2 dark:border-zinc-700/70">
									<h3
										id="agents-heading"
										className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
									>
										Agents
									</h3>
									<fieldset aria-labelledby="agents-heading">
										{isLoadingAgents ? (
											<div className="flex justify-center py-2">
												<Loader2 className="h-5 w-5 animate-spin" />
											</div>
										) : agents.length === 0 ? (
											<p className="text-xs text-zinc-500 dark:text-zinc-400">
												No agents available.
											</p>
										) : (
											<div className="space-y-1">
												{agents.map((agent) => (
													<ModelOption
														key={agent.id}
														model={{
															id: agent.id,
															matchingModel: agent.id,
															name: agent.name,
															provider: "agent",
															modalities: {
																input: ["text"],
																output: ["text"],
															},
															strengths: [],
															isFree: false,
															description: agent.description,
															avatarUrl: agent.avatar_url,
														}}
														isSelected={selectedAgentId === agent.id}
														isActive={false}
														onClick={() => {
															setSelectedAgentId(agent.id);
															setChatMode("agent");
															if (agent.model) {
																handleModelChange(agent.model);
																setIsOpen(false);
															}
														}}
														disabled={isDisabled}
														mono={mono}
														isTeamAgent={agent.is_team_agent}
													/>
												))}
											</div>
										)}
									</fieldset>
								</div>

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
									onInfoHoverStart={handleInfoHoverStart}
									onInfoHoverEnd={handleInfoHoverEnd}
								/>
							</div>
						</TabsContent>

						<TabsContent value="models">
							<div className="space-y-3 pt-2">
								<div className="rounded-lg border border-zinc-200/70 p-2 dark:border-zinc-700/70">
									<div className="flex items-center justify-between">
										<div className="text-xs text-zinc-500 dark:text-zinc-400">
											Model Source:
										</div>
										<div className="flex items-center rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
											<button
												type="button"
												className={`cursor-pointer flex items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
													chatMode === "remote"
														? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
														: "text-zinc-600 dark:text-zinc-400"
												}`}
												onClick={() =>
													chatMode !== "remote" &&
													handleToggleModelSource("remote")
												}
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
												onClick={() =>
													chatMode !== "local" &&
													handleToggleModelSource("local")
												}
												aria-pressed={chatMode === "local"}
											>
												<Computer className="h-3 w-3" />
												Local
											</button>
										</div>
									</div>
								</div>

								<ModelsList
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
									onInfoHoverStart={handleInfoHoverStart}
									onInfoHoverEnd={handleInfoHoverEnd}
								/>
							</div>
						</TabsContent>
					</Tabs>
				</dialog>
			)}
			<HoverPreview preview={hoverPreview} />
		</div>
	);
};
