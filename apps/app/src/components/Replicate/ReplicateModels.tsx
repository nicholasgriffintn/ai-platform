import { Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppCard } from "~/components/Apps/AppCard";
import { groupAppsByCategory } from "~/components/Apps/utils";
import { EmptyState } from "~/components/Core/EmptyState";
import { Button, SearchInput } from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";
import { useReplicateModels } from "~/hooks/useReplicate";
import { cn } from "~/lib/utils";
import type { AppListItem } from "~/types/apps";

const DEFAULT_CATEGORY = "Creative Tools";

const formatTypeLabel = (type: string): string =>
	type.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function ReplicateModels() {
	const { data: models, isLoading, error } = useReplicateModels();
	const navigate = useNavigate();
	const [selectedType, setSelectedType] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const allTypes = useMemo(() => {
		return Array.from(
			new Set(models?.flatMap((model) => model.type) ?? []),
		).sort();
	}, [models]);

	const filteredModels = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		return (models ?? []).filter((model) => {
			if (selectedType && !model.type.includes(selectedType)) {
				return false;
			}

			if (!normalizedQuery) {
				return true;
			}

			const searchableFields = [
				model.name,
				model.description,
				model.category,
				...(model.tags ?? []),
				...model.type,
			]
				.filter(Boolean)
				.map((value) => value!.toLowerCase());

			return searchableFields.some((field) => field.includes(normalizedQuery));
		});
	}, [models, selectedType, searchQuery]);

	const appItems = useMemo<AppListItem[]>(() => {
		return filteredModels.map((model) => ({
			id: model.id,
			name: model.name,
			description: model.description,
			icon: model.icon ?? "sparkles",
			category:
				model.category ?? formatTypeLabel(model.type[0] ?? DEFAULT_CATEGORY),
			theme: model.theme,
			tags: model.tags ?? [...model.type],
			href: model.href ?? `/apps/replicate/${model.id}`,
			kind: model.kind ?? "frontend",
			featured: model.featured,
			type: "premium",
		}));
	}, [filteredModels]);

	const groupedApps = useMemo(() => groupAppsByCategory(appItems), [appItems]);

	const handleModelSelect = useCallback(
		(app: AppListItem) => {
			navigate(app.href ?? `/apps/replicate/${app.id}`);
		},
		[navigate],
	);

	const handlePredictionsClick = useCallback(() => {
		navigate("/apps/replicate/predictions");
	}, [navigate]);

	const handleClearFilters = useCallback(() => {
		setSearchQuery("");
		setSelectedType(null);
	}, []);

	if (isLoading) {
		return (
			<div className="container mx-auto px-4 max-w-7xl">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<CardSkeleton count={6} showHeader showFooter />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
				<h3 className="font-semibold mb-2">Failed to load models</h3>
				<p>Please try again later.</p>
			</div>
		);
	}

	const hasResults = appItems.length > 0;

	return (
		<div>
			<div className="flex flex-col gap-6 mb-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<SearchInput
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder="Search Replicate models..."
						className="w-full md:max-w-md"
					/>
					<Button variant="secondary" onClick={handlePredictionsClick}>
						View my predictions
					</Button>
				</div>

				{allTypes.length > 0 && (
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => setSelectedType(null)}
							className={cn(
								"px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
								selectedType === null
									? "bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 border-zinc-900 dark:border-zinc-200"
									: "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
							)}
						>
							All models
						</button>
						{allTypes.map((type) => (
							<button
								type="button"
								key={type}
								onClick={() => setSelectedType(type)}
								className={cn(
									"px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
									selectedType === type
										? "bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 border-zinc-900 dark:border-zinc-200"
										: "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
								)}
							>
								{formatTypeLabel(type)}
							</button>
						))}
					</div>
				)}
			</div>

			{hasResults ? (
				groupedApps.map(([category, categoryApps]) => (
					<div key={category} className="space-y-6 mb-8">
						<h2
							data-category={category}
							className={cn(
								"text-xl font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-2",
							)}
						>
							{category}
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{categoryApps.map((app) => (
								<div
									key={app.id}
									className="transform transition-transform hover:scale-[1.02] h-[200px]"
								>
									<AppCard app={app} onSelect={() => handleModelSelect(app)} />
								</div>
							))}
						</div>
					</div>
				))
			) : (
				<EmptyState
					icon={<Sparkles className="h-8 w-8 text-zinc-400" />}
					title="No models found"
					message={
						searchQuery || selectedType
							? "Try adjusting your search or filters to discover different models."
							: "No Replicate models are currently available."
					}
					action={
						searchQuery || selectedType ? (
							<Button variant="secondary" onClick={handleClearFilters}>
								Clear filters
							</Button>
						) : undefined
					}
				/>
			)}
		</div>
	);
}
