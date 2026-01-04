import {
	Bot,
	Cloud,
	Computer,
	Loader2,
	Search,
	Server,
	Wand2,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { FormInput, FormSelect } from "~/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import {
	defaultModel,
	getAvailableModels,
	getFeaturedModelIds,
	getModelsByMode,
} from "~/lib/models";
import { useAgentToolDefaults } from "~/hooks/useAgentToolDefaults";
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
	const [showAllModels, setShowAllModels] = useState(false);
	const [selectedCapability, setSelectedCapability] = useState<string | null>(
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
		(acc, [key, m]) => {
			if (m.supportsToolCalls) acc[key] = { ...m, id: key };
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

	useEffect(() => {
		if (searchQuery || selectedCapability) {
			setShowAllModels(true);
		}
	}, [searchQuery, selectedCapability]);

	const selectedModelInfo =
		model === null ? automaticModelOption : filteredModels[model];

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
		if (isOpen) {
			if (!isMobile && searchInputRef.current) {
				searchInputRef.current.focus();
			} else {
				const firstOpt = dropdownRef.current?.querySelector('[role="option"]');
				(firstOpt as HTMLElement | null)?.focus();
			}
		}
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

	const featuredModels = Object.values(filteredModels).filter(
		(model) => featuredModelIds[model.id],
	);

	const otherModels = Object.values(filteredModels).filter(
		(model) => !featuredModelIds[model.id],
	);

	const groupModelsByProvider = (models: ModelConfigItem[]) => {
		return models.reduce(
			(acc, model) => {
				const provider = model.provider || "unknown";
				if (!acc[provider]) {
					acc[provider] = [];
				}
				acc[provider].push(model);
				return acc;
			},
			{} as Record<string, ModelConfigItem[]>,
		);
	};

	const groupedFeaturedModels = groupModelsByProvider(featuredModels);
	const groupedOtherModels = groupModelsByProvider(otherModels);

	const capabilities = Array.from(
		new Set(
			Object.values(filteredModels).flatMap((model) => model.strengths || []),
		),
	).sort();

	const capabilityOptions = [
		{ value: "", label: "All" },
		...capabilities.map((capability) => ({
			value: capability,
			label: capability,
		})),
	];

	const filterModels = (models: Record<string, ModelConfigItem[]>) => {
		const result: Record<string, ModelConfigItem[]> = {};

		for (const [provider, providerModels] of Object.entries(models)) {
			const filtered = providerModels.filter((model) => {
				const matchesSearch =
					searchQuery === "" ||
					(
						model.name?.toLowerCase() || model.matchingModel.toLowerCase()
					).includes(searchQuery.toLowerCase()) ||
					(model.description?.toLowerCase() || "").includes(
						searchQuery.toLowerCase(),
					);

				const matchesCapability =
					!selectedCapability ||
					model.strengths?.includes(selectedCapability) ||
					false;

				return matchesSearch && matchesCapability;
			});

			if (filtered.length > 0) {
				result[provider] = filtered;
			}
		}

		return result;
	};

	const filteredFeaturedModels = filterModels(groupedFeaturedModels);
	const filteredOtherModels = featuredOnly
		? ({} as Record<string, ModelConfigItem[]>)
		: filterModels(groupedOtherModels);

	const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
	const isModelLockedByAgent = selectedAgent?.model;

	useAgentToolDefaults({
		agents,
		selectedAgentId,
		chatMode,
	});

	useEffect(() => {
		if (selectedAgentId) {
			const agent = agents.find((a) => a.id === selectedAgentId);
			if (agent?.model) {
				setModel(agent.model);
			}
		}
	}, [selectedAgentId, agents, setModel]);

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
					className="absolute bottom-full left-0 mb-1 w-[400px] bg-off-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg z-50"
					aria-label="Model selection dialog"
				>
					{selectedTab !== "auto" && (
						<div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
							<div className="flex items-center gap-2">
								<div className="relative w-58 flex-shrink-0">
									<FormInput
										ref={searchInputRef}
										placeholder="Search..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-8 w-full"
										aria-label="Search"
										fullWidth={false}
									/>
									<div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
										<Search
											className="h-4 w-4 text-zinc-400"
											aria-hidden="true"
										/>
									</div>
								</div>
								<div className="w-35 flex-shrink-0">
									<FormSelect
										value={selectedCapability || ""}
										onChange={(e) =>
											setSelectedCapability(e.target.value || null)
										}
										options={capabilityOptions}
										aria-label="Filter by capability"
										className="text-sm w-full"
										fullWidth={false}
									/>
								</div>
							</div>
						</div>
					)}
					<Tabs
						value={selectedTab}
						onValueChange={(val) => {
							const tab = val as "auto" | "agent" | "models";
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
						className="px-2 pt-2"
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
							<div>
								<div className="pt-2 pb-2 border-b border-zinc-200 dark:border-zinc-700 max-h-[100px] overflow-y-auto">
									<h3
										id="agents-heading"
										className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
									>
										Agents
									</h3>
									<fieldset aria-labelledby="agents-heading">
										{isLoadingAgents ? (
											<div className="flex justify-center py-2">
												<Loader2 className="h-5 w-5 animate-spin" />
											</div>
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
								<div className="pt-2 max-h-[200px] overflow-y-auto">
									<h3
										id="models-heading"
										className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
									>
										Models
									</h3>
									<ModelsList
										disabled={isModelLockedByAgent}
										featured={filteredFeaturedModels}
										other={filteredOtherModels}
										showAll={showAllModels}
										setShowAll={setShowAllModels}
										showAllDisabled={!!(searchQuery || selectedCapability)}
										isDisabled={isDisabled}
										isPro={isPro}
										selectedId={selectedModelInfo?.id}
										onSelect={(id) => {
											handleModelChange(id);
											setIsOpen(false);
										}}
										mono={mono}
									/>
								</div>
							</div>
						</TabsContent>
						<TabsContent value="models">
							<div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
								<div className="flex items-center justify-between">
									<div className="text-xs text-zinc-500 dark:text-zinc-400">
										Model Source:
									</div>
									<div className="flex items-center">
										<button
											type="button"
											className={`cursor-pointer flex items-center justify-center gap-1 py-1 px-2 rounded text-xs ${
												chatMode === "remote"
													? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200"
													: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
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
										<span className="mx-1 text-zinc-400">|</span>
										<button
											type="button"
											className={`cursor-pointer flex items-center justify-center gap-1 py-1 px-2 rounded text-xs ${
												chatMode === "local"
													? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200"
													: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
											}`}
											onClick={() =>
												chatMode !== "local" && handleToggleModelSource("local")
											}
											aria-pressed={chatMode === "local"}
										>
											<Computer className="h-3 w-3" />
											Local
										</button>
									</div>
								</div>
							</div>
							<div className="pt-4 max-h-[300px] overflow-y-auto">
								<ModelsList
									featured={filteredFeaturedModels}
									other={filteredOtherModels}
									showAll={showAllModels}
									setShowAll={setShowAllModels}
									showAllDisabled={!!(searchQuery || selectedCapability)}
									isDisabled={isDisabled}
									isPro={isPro}
									selectedId={selectedModelInfo?.id}
									onSelect={(id) => {
										handleModelChange(id);
										setIsOpen(false);
									}}
									mono={mono}
								/>
							</div>
						</TabsContent>
					</Tabs>
				</dialog>
			)}
		</div>
	);
};
