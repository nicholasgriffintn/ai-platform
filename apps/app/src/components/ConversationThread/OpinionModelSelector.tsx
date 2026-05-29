import { CheckCircle2, MessageSquareQuote, Scale } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui";
import { SearchInput } from "~/components/ui/SearchInput";
import { useConversationModelOptions } from "~/hooks/useConversationModelOptions";
import type { OpinionMode, OpinionRequest } from "~/lib/chat/opinion";
import { cn } from "~/lib/utils";
import { ConversationModelOption } from "./ConversationModelOption";

const MAX_CONSENSUS_MODELS = 3;

interface OpinionModelSelectorProps {
	onSubmit: (request: OpinionRequest) => void;
	onCancel: () => void;
	sourceModelId?: string;
	className?: string;
}

export function OpinionModelSelector({
	onSubmit,
	onCancel,
	sourceModelId,
	className,
}: OpinionModelSelectorProps) {
	const [mode, setMode] = useState<OpinionMode>("second-opinion");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
	const excludedModelIds = useMemo(() => [sourceModelId], [sourceModelId]);
	const { featuredModels, isLoading, searchModels, selectableModels } = useConversationModelOptions(
		{
			excludeCurrentModel: true,
			excludedModelIds,
			requiredOutputModality: "text",
		},
	);
	const searchResults = useMemo(() => searchModels(searchQuery), [searchModels, searchQuery]);
	const recommendedModelIds = useMemo(() => {
		const recommended = featuredModels.length ? featuredModels : selectableModels;
		return recommended.slice(0, MAX_CONSENSUS_MODELS).map((modelItem) => modelItem.id);
	}, [featuredModels, selectableModels]);
	const isSearching = searchQuery.trim().length > 0;
	const visibleSearchResults = isSearching ? searchResults : [];
	const submitDisabled =
		selectedModelIds.length === 0 || (mode === "consensus" && selectedModelIds.length < 2);

	useEffect(() => {
		if (selectedModelIds.length > 0 || recommendedModelIds.length === 0) {
			return;
		}

		setSelectedModelIds([recommendedModelIds[0]]);
	}, [recommendedModelIds, selectedModelIds.length]);

	const toggleMode = (nextMode: OpinionMode) => {
		setMode(nextMode);
		if (nextMode === "second-opinion") {
			setSelectedModelIds((ids) => ids.slice(0, 1));
			return;
		}

		setSelectedModelIds((ids) => {
			if (ids.length >= 2) {
				return ids.slice(0, MAX_CONSENSUS_MODELS);
			}
			return recommendedModelIds.slice(0, Math.max(2, ids.length));
		});
	};

	const toggleModel = (modelId: string) => {
		setSelectedModelIds((ids) => {
			if (mode === "second-opinion") {
				return [modelId];
			}

			if (ids.includes(modelId)) {
				return ids.filter((id) => id !== modelId);
			}

			if (ids.length >= MAX_CONSENSUS_MODELS) {
				return ids;
			}

			return [...ids, modelId];
		});
	};

	const handleSubmit = () => {
		if (submitDisabled) {
			return;
		}

		onSubmit({
			mode,
			modelIds: selectedModelIds,
		});
	};

	return (
		<div className={cn("w-full overflow-hidden rounded-lg bg-white dark:bg-zinc-900", className)}>
			<div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
				<div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
					<button
						type="button"
						onClick={() => toggleMode("second-opinion")}
						className={cn(
							"flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
							mode === "second-opinion"
								? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
								: "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100",
						)}
					>
						<MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
						Second opinion
					</button>
					<button
						type="button"
						onClick={() => toggleMode("consensus")}
						className={cn(
							"flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
							mode === "consensus"
								? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
								: "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100",
						)}
					>
						<Scale className="h-3.5 w-3.5" aria-hidden />
						Consensus
					</button>
				</div>
				<div className="mt-2">
					<SearchInput
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder="Search models"
						className="[&_input]:py-1.5 [&_input]:text-sm"
						autoFocus
					/>
				</div>
			</div>
			<div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-2 sm:max-h-80">
				{isLoading && (
					<p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">Loading models...</p>
				)}
				{isSearching && (
					<div>
						<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
							Search Results
						</div>
						{visibleSearchResults.length > 0 ? (
							visibleSearchResults.map((modelItem) => (
								<ConversationModelOption
									key={modelItem.id}
									model={modelItem}
									isSelected={selectedModelIds.includes(modelItem.id)}
									isDisabled={
										mode === "consensus" &&
										!selectedModelIds.includes(modelItem.id) &&
										selectedModelIds.length >= MAX_CONSENSUS_MODELS
									}
									onSelect={toggleModel}
									showCheckbox
								/>
							))
						) : (
							<p className="rounded-md border border-dashed border-zinc-300 px-2 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
								No matching models.
							</p>
						)}
					</div>
				)}
				{featuredModels.length > 0 && (
					<div className={isSearching ? "mt-3" : ""}>
						<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
							Featured Models
						</div>
						{featuredModels.map((modelItem) => (
							<ConversationModelOption
								key={modelItem.id}
								model={modelItem}
								isSelected={selectedModelIds.includes(modelItem.id)}
								isDisabled={
									mode === "consensus" &&
									!selectedModelIds.includes(modelItem.id) &&
									selectedModelIds.length >= MAX_CONSENSUS_MODELS
								}
								onSelect={toggleModel}
								showCheckbox
							/>
						))}
					</div>
				)}
				{!isLoading && !isSearching && featuredModels.length === 0 && (
					<p className="rounded-md border border-dashed border-zinc-300 px-2 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
						No opinion models are available.
					</p>
				)}
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-zinc-200 p-2 dark:border-zinc-700">
				<span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
					<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
					{selectedModelIds.length || 0} selected
				</span>
				<div className="flex items-center gap-2">
					<Button type="button" variant="ghost" size="xs" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="primary"
						size="xs"
						disabled={submitDisabled}
						onClick={handleSubmit}
					>
						{mode === "consensus" ? "Ask for consensus" : "Ask for opinion"}
					</Button>
				</div>
			</div>
		</div>
	);
}
