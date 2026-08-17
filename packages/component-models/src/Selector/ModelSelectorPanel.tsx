import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ngriffin_uk/polychat-component-ui";
import type {
	ChatMode,
	ModelCatalogItem,
	ModelConfigItem,
	ModelModality,
	ModelRouterMode,
} from "@ngriffin_uk/polychat-schemas";
import { Cloud, Computer, Filter, Gauge, Search, Server } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";

import { AutoModePicker } from "./AutoModePicker";
import { ModelsList } from "./ModelsList";

export type ModelSelectorTab = "auto" | "models";

export interface ModelSelectorPanelLayout {
	left: number;
	width: number;
}

export interface ModelSelectorPanelProps {
	panelRef: RefObject<HTMLDivElement | null>;
	searchInputRef: RefObject<HTMLInputElement | null>;
	layout: ModelSelectorPanelLayout | null;
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;

	selectedTab: ModelSelectorTab;
	onTabChange: (tab: ModelSelectorTab) => void;
	/** Hides the auto tab entirely when the surface only offers a model list. */
	showAutoTab: boolean;

	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	capabilities: ModelModality[];
	selectedCapability: ModelModality | null;
	onCapabilityChange: (capability: ModelModality | null) => void;

	/** Omitted on surfaces such as live sessions where local models are not offered. */
	chatMode?: ChatMode;
	onChatModeChange?: (mode: ChatMode) => void;

	autoModeModels: ModelConfigItem[];
	autoMode: ModelRouterMode;
	onAutoModeChange: (mode: ModelRouterMode) => void;

	models: ModelCatalogItem[];
	featuredModelIds: Record<string, ModelCatalogItem>;
	isDisabled?: boolean;
	isModelLocked?: boolean;
	isPro: boolean;
	mono?: boolean;
	selectedModelId?: string;
	onModelSelect: (id: string, model: ModelCatalogItem) => void;
	onInfoHoverStart?: (model: ModelConfigItem, anchorRect: DOMRect) => void;
	onInfoHoverEnd?: () => void;
}

export function ModelSelectorPanel({
	panelRef,
	searchInputRef,
	layout,
	onKeyDown,
	selectedTab,
	onTabChange,
	showAutoTab,
	searchQuery,
	onSearchQueryChange,
	capabilities,
	selectedCapability,
	onCapabilityChange,
	chatMode,
	onChatModeChange,
	autoModeModels,
	autoMode,
	onAutoModeChange,
	models,
	featuredModelIds,
	isDisabled,
	isModelLocked = false,
	isPro,
	mono,
	selectedModelId,
	onModelSelect,
	onInfoHoverStart,
	onInfoHoverEnd,
}: ModelSelectorPanelProps) {
	const showModelSource = Boolean(chatMode && onChatModeChange);

	return (
		<div
			ref={panelRef}
			onKeyDown={onKeyDown}
			role="dialog"
			tabIndex={-1}
			aria-modal="false"
			style={layout ? { left: `${layout.left}px`, width: `${layout.width}px` } : undefined}
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
								onChange={(event) => onSearchQueryChange(event.target.value)}
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
								onChange={(event) => {
									const nextCapability =
										capabilities.find((capability) => capability === event.target.value) ?? null;
									onCapabilityChange(nextCapability);
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
					const tab = value as ModelSelectorTab;
					if (!showAutoTab && tab !== "models") return;
					onTabChange(tab);
				}}
				className="min-h-0 flex-1 px-2 pb-2 pt-2"
			>
				{showAutoTab && (
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
								disabled={isDisabled || isModelLocked}
								onSelectMode={onAutoModeChange}
							/>
						</TabsContent>
					</>
				)}

				<TabsContent value="models" className="flex min-h-0 flex-col overflow-hidden">
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						{showModelSource && (
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
											onClick={() => chatMode !== "remote" && onChatModeChange?.("remote")}
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
											onClick={() => chatMode !== "local" && onChatModeChange?.("local")}
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
							disabled={isModelLocked}
							models={models}
							featuredModelIds={featuredModelIds}
							isDisabled={isDisabled}
							isPro={isPro}
							selectedId={selectedModelId}
							onSelect={onModelSelect}
							mono={mono}
							isSearchActive={searchQuery.trim().length > 0}
							onInfoHoverStart={onInfoHoverStart}
							onInfoHoverEnd={onInfoHoverEnd}
						/>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
