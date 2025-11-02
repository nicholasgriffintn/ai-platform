import { ChevronDown, ChevronUp } from "lucide-react";

import { useTrackEvent } from "~/hooks/use-track-event";
import type { ModelConfigItem } from "~/types";
import { ModelOption } from "./ModelOption";

interface ModelsListProps {
	featured: Record<string, ModelConfigItem[]>;
	other: Record<string, ModelConfigItem[]>;
	showAll: boolean;
	setShowAll: (show: boolean) => void;
	showAllDisabled: boolean;
	isDisabled?: boolean;
	isPro: boolean;
	selectedId?: string | null;
	onSelect: (id: string) => void;
	mono?: boolean;
	disabled?: boolean;
}

export function ModelsList({
	featured,
	other,
	showAll,
	setShowAll,
	showAllDisabled,
	isDisabled,
	isPro,
	selectedId,
	onSelect,
	mono,
	disabled,
}: ModelsListProps) {
	const { trackFeatureUsage } = useTrackEvent();

	const handleModelSelect = (modelId: string, modelInfo: ModelConfigItem) => {
		trackFeatureUsage("model_selected", {
			model_id: modelId,
			previous_model_id: selectedId || "none",
			model_provider: modelInfo.provider,
			is_free_model: String(modelInfo.isFree),
		});

		onSelect(modelId);
	};

	const featuredKeys = Object.keys(featured);
	const otherKeys = Object.keys(other);

	if (!featuredKeys.length && !otherKeys.length) {
		return (
			<div className="p-2">
				<p className="text-left text-sm text-zinc-500 dark:text-zinc-400 pb-4">
					No models could be found with your filters.
				</p>
			</div>
		);
	}

	return (
		<>
			{featuredKeys.length > 0 && (
				<div className="border-b border-zinc-200 dark:border-zinc-700">
					<fieldset aria-labelledby="featured-models-heading">
						{Object.entries(featured)
							.sort(([a], [b]) => a.localeCompare(b))
							.map(([provider, models]) => (
								<div key={provider} className="mb-2">
									<div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
										{provider.charAt(0).toUpperCase() + provider.slice(1)}
									</div>
									{models.map((m) => {
										const disabledOption = isDisabled || (!isPro && !m.isFree);
										return (
											<ModelOption
												key={m.matchingModel}
												model={m}
												isSelected={m.id === selectedId}
												onClick={() => handleModelSelect(m.id, m)}
												disabled={disabledOption || disabled}
												isActive={false}
												mono={mono}
											/>
										);
									})}
								</div>
							))}
					</fieldset>
				</div>
			)}

			{otherKeys.length > 0 && (
				<div className="p-2">
					<button
						type="button"
						onClick={() => setShowAll(!showAll)}
						className="cursor-pointer flex items-center justify-between w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
						disabled={showAllDisabled}
						aria-expanded={showAll}
						aria-controls="other-models-section"
					>
						<span>
							Other Models {`(${Object.values(other).flat().length})`}
						</span>
						{showAll ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</button>

					{showAll && (
						<div id="other-models-section">
							{Object.entries(other)
								.sort(([a], [b]) => a.localeCompare(b))
								.map(([provider, models]) => (
									<div key={provider} className="mb-2">
										<div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
											{provider.charAt(0).toUpperCase() + provider.slice(1)}
										</div>
										{models.map((m) => {
											const disabledOption =
												isDisabled || (!isPro && !m.isFree);
											return (
												<ModelOption
													key={m.matchingModel}
													model={m}
													isSelected={m.id === selectedId}
													onClick={() => handleModelSelect(m.id, m)}
													disabled={disabledOption}
													isActive={false}
													mono={mono}
												/>
											);
										})}
									</div>
								))}
						</div>
					)}
				</div>
			)}
		</>
	);
}
