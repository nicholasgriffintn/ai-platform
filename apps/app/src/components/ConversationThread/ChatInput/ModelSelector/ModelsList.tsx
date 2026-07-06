import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
	collapseRegionalModelVariants,
	getSelectedRegionalModelId,
	isRegionalModelEntrySelected,
	type RegionalModelListEntry,
} from "~/lib/model-region-variants";
import { getModelDisplayName, isModelSelectableForAccount } from "~/lib/models";
import { formatProviderLabel } from "~/lib/provider-display";
import { cn } from "~/lib/utils";
import type { ModelCatalogItem, ModelConfigItem } from "@assistant/schemas";
import { ModelOption } from "./ModelOption";

interface ModelsListProps {
	models: ModelCatalogItem[];
	featuredModelIds: Record<string, ModelCatalogItem>;
	isDisabled?: boolean;
	isPro: boolean;
	selectedId?: string | null;
	onSelect: (id: string) => void;
	mono?: boolean;
	disabled?: boolean;
	isSearchActive?: boolean;
	onInfoHoverStart?: (model: ModelConfigItem, anchorRect: DOMRect) => void;
	onInfoHoverEnd?: () => void;
}

interface ProviderListEntry {
	key: string;
	label: string;
	models: RegionalModelListEntry[];
}

const FEATURED_PROVIDER_KEY = "featured";

function getSelectedModelProvider(models: ModelCatalogItem[], selectedId?: string | null) {
	if (!selectedId) return null;
	return models.find((model) => model.id === selectedId)?.provider || null;
}

export function ModelsList({
	models,
	featuredModelIds,
	isDisabled,
	isPro,
	selectedId,
	onSelect,
	mono,
	disabled,
	isSearchActive = false,
	onInfoHoverStart,
	onInfoHoverEnd,
}: ModelsListProps) {
	const { trackFeatureUsage } = useTrackEvent();
	const modelListRef = useRef<HTMLDivElement>(null);
	const syncedSelectedIdRef = useRef<string | null | undefined>(undefined);
	const selectedModelProvider = useMemo(
		() => getSelectedModelProvider(models, selectedId),
		[models, selectedId],
	);
	const [selectedProvider, setSelectedProvider] = useState<string>(
		() => selectedModelProvider || FEATURED_PROVIDER_KEY,
	);
	const [showDeprecatedByProvider, setShowDeprecatedByProvider] = useState<Record<string, boolean>>(
		{},
	);
	const modelsById = useMemo(() => {
		return models.reduce(
			(acc, model) => {
				acc[model.id] = model;
				return acc;
			},
			{} as Record<string, ModelCatalogItem>,
		);
	}, [models]);

	const handleModelSelect = (modelId: string, modelInfo: ModelCatalogItem) => {
		trackFeatureUsage("model_selected", {
			model_id: modelId,
			previous_model_id: selectedId || "none",
			model_provider: modelInfo.provider,
			is_free_model: String(modelInfo.isFree),
		});

		onSelect(modelId);
	};

	const featuredModels = useMemo(
		() =>
			models
				.filter((model) => featuredModelIds[model.id])
				.sort((a, b) => getModelDisplayName(a).localeCompare(getModelDisplayName(b))),
		[models, featuredModelIds],
	);

	const groupedByProvider = useMemo(() => {
		return models.reduce(
			(acc, model) => {
				const provider = model.provider || "unknown";
				if (!acc[provider]) {
					acc[provider] = [];
				}
				acc[provider].push(model);
				return acc;
			},
			{} as Record<string, ModelCatalogItem[]>,
		);
	}, [models]);

	const providerEntries = useMemo(() => {
		const providerLists: ProviderListEntry[] = Object.entries(groupedByProvider)
			.sort(([providerA], [providerB]) => providerA.localeCompare(providerB))
			.map(([provider, providerModels]) => {
				const sortedModels = [...providerModels].sort((a, b) =>
					getModelDisplayName(a).localeCompare(getModelDisplayName(b)),
				);

				return {
					key: provider,
					label: formatProviderLabel(provider),
					models: collapseRegionalModelVariants(sortedModels),
				};
			});

		return featuredModels.length > 0
			? [
					{
						key: FEATURED_PROVIDER_KEY,
						label: "Featured",
						models: collapseRegionalModelVariants(featuredModels),
					},
					...providerLists,
				]
			: providerLists;
	}, [groupedByProvider, featuredModels]);

	useEffect(() => {
		if (providerEntries.length === 0) return;

		const providerExists = providerEntries.some(
			(providerEntry) => providerEntry.key === selectedProvider,
		);
		if (providerExists) return;

		const selectedProviderExists = providerEntries.some(
			(providerEntry) => providerEntry.key === selectedModelProvider,
		);
		const fallbackProvider =
			(selectedProviderExists && selectedModelProvider) ||
			providerEntries.find((providerEntry) => providerEntry.key === FEATURED_PROVIDER_KEY)?.key ||
			providerEntries[0].key;

		setSelectedProvider(fallbackProvider);
	}, [providerEntries, selectedModelProvider, selectedProvider]);

	useEffect(() => {
		if (!selectedModelProvider) return;
		const selectedProviderExists = providerEntries.some(
			(providerEntry) => providerEntry.key === selectedModelProvider,
		);
		if (!selectedProviderExists) return;
		if (syncedSelectedIdRef.current === selectedId) return;

		syncedSelectedIdRef.current = selectedId;

		setSelectedProvider(selectedModelProvider);
	}, [providerEntries, selectedId, selectedModelProvider]);

	const selectedProviderEntry =
		providerEntries.find((entry) => entry.key === selectedProvider) || providerEntries[0];
	const visibleModels = selectedProviderEntry?.models || [];
	const visibleActiveModels = visibleModels.filter((entry) => !entry.model.deprecated);
	const visibleDeprecatedModels = visibleModels.filter((entry) => entry.model.deprecated);
	const selectedDeprecatedModel = selectedId
		? models.find((model) => model.id === selectedId && model.deprecated)
		: undefined;
	const showDeprecatedForSelectedProvider =
		showDeprecatedByProvider[selectedProviderEntry?.key || ""] ?? false;
	const searchResultEntries = providerEntries.filter(
		(providerEntry) => providerEntry.key !== FEATURED_PROVIDER_KEY,
	);
	const visibleModelCount = isSearchActive
		? searchResultEntries.reduce((total, providerEntry) => total + providerEntry.models.length, 0)
		: visibleModels.length;

	useEffect(() => {
		if (!selectedDeprecatedModel?.provider) return;

		setShowDeprecatedByProvider((prev) => {
			if (prev[selectedDeprecatedModel.provider] === true) return prev;

			return {
				...prev,
				[selectedDeprecatedModel.provider]: true,
			};
		});
	}, [selectedDeprecatedModel?.provider, selectedId]);

	useEffect(() => {
		if (isSearchActive || !selectedId) return;
		if (!visibleModels.some((entry) => isRegionalModelEntrySelected(entry, selectedId))) return;

		const selectedModelOption = modelListRef.current?.querySelector<HTMLElement>(
			'[data-model-option][aria-selected="true"]',
		);
		selectedModelOption?.scrollIntoView({ block: "center" });
	}, [isSearchActive, selectedId, visibleModels]);

	if (!providerEntries.length) {
		return (
			<div className="p-2">
				<p className="pb-4 text-left text-sm text-zinc-500 dark:text-zinc-400">
					No models could be found with your filters.
				</p>
			</div>
		);
	}

	const renderModelEntry = (modelEntry: RegionalModelListEntry) => {
		const modelItem = modelEntry.model;
		const selectedRegionModelId = getSelectedRegionalModelId(modelEntry, selectedId);
		const selectedRegionModel = modelsById[selectedRegionModelId] || modelItem;
		const disabledOption = isDisabled || !isModelSelectableForAccount(modelItem, isPro) || disabled;

		return (
			<ModelOption
				key={modelItem.id}
				model={modelItem}
				isSelected={isRegionalModelEntrySelected(modelEntry, selectedId)}
				isActive={false}
				onClick={() => handleModelSelect(selectedRegionModelId, selectedRegionModel)}
				disabled={disabledOption}
				mono={mono}
				regionOptions={modelEntry.regionOptions}
				selectedRegionModelId={selectedRegionModelId}
				onRegionSelect={(modelId) => handleModelSelect(modelId, modelsById[modelId] || modelItem)}
				onInfoHoverStart={onInfoHoverStart}
				onInfoHoverEnd={onInfoHoverEnd}
			/>
		);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200/70 bg-white/60 dark:border-zinc-700/70 dark:bg-zinc-900/50">
			<div className="flex min-h-0 flex-1 flex-col max-h-[320px] sm:max-h-[420px] sm:min-h-[320px] sm:flex-row">
				{!isSearchActive && (
					<div className="border-b border-zinc-200/70 dark:border-zinc-700/70 sm:flex sm:w-16 sm:flex-col sm:border-b-0 sm:border-r md:w-20">
						<div className="overflow-x-auto px-2 py-2 sm:flex-1 sm:overflow-x-hidden sm:overflow-y-auto sm:px-2">
							<div className="flex gap-2 sm:space-y-1 sm:block">
								{providerEntries.map((providerEntry) => {
									const isFeaturedProvider = providerEntry.key === FEATURED_PROVIDER_KEY;
									const isSelected = selectedProvider === providerEntry.key;
									return (
										<button
											key={providerEntry.key}
											type="button"
											onClick={() => {
												onInfoHoverEnd?.();
												setSelectedProvider(providerEntry.key);
											}}
											className={cn(
												"flex min-w-[88px] flex-shrink-0 items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition-colors sm:w-full sm:min-w-0 sm:flex-col sm:gap-1 sm:px-1 sm:text-[11px]",
												isSelected
													? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/30 dark:text-fuchsia-200"
													: "border-transparent text-zinc-500 hover:border-zinc-300 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
											)}
											aria-pressed={isSelected}
											title={providerEntry.label}
										>
											{isFeaturedProvider ? (
												<Sparkles className="h-4 w-4" />
											) : (
												<ModelIcon
													modelName={providerEntry.label}
													provider={providerEntry.key}
													size={18}
													mono={mono}
												/>
											)}
											<span className="line-clamp-1 min-w-0 flex-1 text-left sm:w-full sm:flex-none sm:text-center">
												{isFeaturedProvider ? "Featured" : providerEntry.label.split(" ")[0]}
											</span>
											<span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
												{providerEntry.models.length}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					</div>
				)}

				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="flex-shrink-0 border-b border-zinc-200/70 px-3 py-2 dark:border-zinc-700/70">
						<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
							<h4 className="text-sm font-semibold text-zinc-900 whitespace-normal break-words dark:text-zinc-100">
								{isSearchActive ? "Search results" : selectedProviderEntry?.label || "Models"}
							</h4>
							<span className="flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
								{visibleModelCount} model{visibleModelCount === 1 ? "" : "s"}
							</span>
						</div>
					</div>
					<div
						ref={modelListRef}
						className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
						onMouseLeave={() => onInfoHoverEnd?.()}
					>
						<div role="group" aria-label="Available models">
							{isSearchActive ? (
								<div className="space-y-4">
									{searchResultEntries.map((providerEntry) => {
										const activeModels = providerEntry.models.filter(
											(modelEntry) => !modelEntry.model.deprecated,
										);
										const deprecatedModels = providerEntry.models.filter(
											(modelEntry) => modelEntry.model.deprecated,
										);
										const showDeprecated = showDeprecatedByProvider[providerEntry.key] ?? false;
										return (
											<div key={providerEntry.key} className="space-y-1">
												<div className="flex items-center justify-between gap-2 px-1 py-1">
													<h5 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
														{providerEntry.label}
													</h5>
													<span className="text-xs text-zinc-500 dark:text-zinc-400">
														{providerEntry.models.length}
													</span>
												</div>
												{activeModels.map(renderModelEntry)}
												{deprecatedModels.length > 0 && (
													<div className="pt-1">
														<button
															type="button"
															className="w-full rounded-md border border-zinc-200 px-2 py-1 text-left text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
															onClick={() =>
																setShowDeprecatedByProvider((prev) => ({
																	...prev,
																	[providerEntry.key]: !showDeprecated,
																}))
															}
														>
															{showDeprecated ? "Hide" : "Show"} deprecated models (
															{deprecatedModels.length})
														</button>
														{showDeprecated && (
															<div className="mt-1 space-y-1">
																{deprecatedModels.map(renderModelEntry)}
															</div>
														)}
													</div>
												)}
											</div>
										);
									})}
								</div>
							) : (
								<div className="space-y-1">
									{visibleActiveModels.map(renderModelEntry)}
									{visibleDeprecatedModels.length > 0 && (
										<div className="pt-1">
											<button
												type="button"
												className="w-full rounded-md border border-zinc-200 px-2 py-1 text-left text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
												onClick={() =>
													setShowDeprecatedByProvider((prev) => ({
														...prev,
														[selectedProviderEntry.key]: !showDeprecatedForSelectedProvider,
													}))
												}
											>
												{showDeprecatedForSelectedProvider ? "Hide" : "Show"} deprecated models (
												{visibleDeprecatedModels.length})
											</button>
											{showDeprecatedForSelectedProvider && (
												<div className="mt-1 space-y-1">
													{visibleDeprecatedModels.map(renderModelEntry)}
												</div>
											)}
										</div>
									)}
								</div>
							)}
						</div>
						{!isSearchActive && visibleModels.length === 0 && (
							<div className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
								No models available in this category.
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
