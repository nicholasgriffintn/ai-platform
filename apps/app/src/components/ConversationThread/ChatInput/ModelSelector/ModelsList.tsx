import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { useTrackEvent } from "~/hooks/use-track-event";
import { cn } from "~/lib/utils";
import type { ModelConfigItem } from "~/types";
import { ModelOption } from "./ModelOption";

interface ModelsListProps {
	models: ModelConfigItem[];
	featuredModelIds: Record<string, ModelConfigItem>;
	isDisabled?: boolean;
	isPro: boolean;
	selectedId?: string | null;
	onSelect: (id: string) => void;
	mono?: boolean;
	disabled?: boolean;
	onInfoHoverStart?: (model: ModelConfigItem, anchorRect: DOMRect) => void;
	onInfoHoverEnd?: () => void;
}

interface ProviderListEntry {
	key: string;
	label: string;
	models: ModelConfigItem[];
}

const FEATURED_PROVIDER_KEY = "featured";

function getModelDisplayName(model: ModelConfigItem) {
	return model.name || model.matchingModel;
}

function formatProviderLabel(provider: string) {
	return provider
		.split(/[-_]/g)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
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
	onInfoHoverStart,
	onInfoHoverEnd,
}: ModelsListProps) {
	const { trackFeatureUsage } = useTrackEvent();
	const [selectedProvider, setSelectedProvider] = useState<string>(
		FEATURED_PROVIDER_KEY,
	);

	const handleModelSelect = (modelId: string, modelInfo: ModelConfigItem) => {
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
				.sort((a, b) =>
					getModelDisplayName(a).localeCompare(getModelDisplayName(b)),
				),
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
			{} as Record<string, ModelConfigItem[]>,
		);
	}, [models]);

	const providerEntries = useMemo(() => {
		const providerLists: ProviderListEntry[] = Object.entries(groupedByProvider)
			.sort(([providerA], [providerB]) => providerA.localeCompare(providerB))
			.map(([provider, providerModels]) => ({
				key: provider,
				label: formatProviderLabel(provider),
				models: providerModels.sort((a, b) =>
					getModelDisplayName(a).localeCompare(getModelDisplayName(b)),
				),
			}));

		return featuredModels.length > 0
			? [
					{
						key: FEATURED_PROVIDER_KEY,
						label: "Featured",
						models: featuredModels,
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

		const fallbackProvider =
			providerEntries.find(
				(providerEntry) => providerEntry.key === FEATURED_PROVIDER_KEY,
			)?.key || providerEntries[0].key;

		setSelectedProvider(fallbackProvider);
	}, [providerEntries, selectedProvider]);

	const selectedProviderEntry =
		providerEntries.find((entry) => entry.key === selectedProvider) ||
		providerEntries[0];
	const visibleModels = selectedProviderEntry?.models || [];

	if (!providerEntries.length) {
		return (
			<div className="p-2">
				<p className="pb-4 text-left text-sm text-zinc-500 dark:text-zinc-400">
					No models could be found with your filters.
				</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border border-zinc-200/70 bg-white/60 dark:border-zinc-700/70 dark:bg-zinc-900/50">
			<div className="flex max-h-[min(60vh,400px)] min-h-[280px] sm:max-h-[420px] sm:min-h-[320px]">
				<div className="flex w-20 flex-col border-r border-zinc-200/70 dark:border-zinc-700/70 sm:w-24 md:w-28">
					<div className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2 sm:px-2">
						<div className="space-y-1">
							{providerEntries.map((providerEntry) => {
								const isFeaturedProvider =
									providerEntry.key === FEATURED_PROVIDER_KEY;
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
											"flex w-full flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] transition-colors sm:text-[11px]",
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
										<span className="line-clamp-1 w-full text-center">
											{isFeaturedProvider
												? "Featured"
												: providerEntry.label.split(" ")[0]}
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

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex-shrink-0 border-b border-zinc-200/70 px-3 py-2 dark:border-zinc-700/70">
						<div className="flex items-center justify-between gap-2">
							<h4 className="text-sm font-semibold text-zinc-900 whitespace-normal break-words dark:text-zinc-100">
								{selectedProviderEntry?.label || "Models"}
							</h4>
							<span className="flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
								{visibleModels.length} model
								{visibleModels.length === 1 ? "" : "s"}
							</span>
						</div>
					</div>
					<div
						className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
						onMouseLeave={() => onInfoHoverEnd?.()}
					>
						<fieldset role="listbox" aria-label="Available models">
							<div className="space-y-1">
								{visibleModels.map((modelItem) => {
									const disabledOption =
										isDisabled || (!isPro && !modelItem.isFree) || disabled;
									return (
										<ModelOption
											key={modelItem.id}
											model={modelItem}
											isSelected={modelItem.id === selectedId}
											isActive={false}
											onClick={() => handleModelSelect(modelItem.id, modelItem)}
											disabled={disabledOption}
											mono={mono}
											onInfoHoverStart={onInfoHoverStart}
											onInfoHoverEnd={onInfoHoverEnd}
										/>
									);
								})}
							</div>
						</fieldset>
						{visibleModels.length === 0 && (
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
