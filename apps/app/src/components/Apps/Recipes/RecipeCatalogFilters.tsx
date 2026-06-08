import type { RecipeKind } from "@assistant/schemas";

import { Button, SearchInput } from "~/components/ui";
import { type RecipeKindFilter, recipeKindLabels } from "~/lib/recipes";
import { cn } from "~/lib/utils";

interface RecipeCatalogFiltersProps {
	search: string;
	kind: RecipeKindFilter;
	category: string;
	categories: string[];
	onSearchChange: (search: string) => void;
	onKindChange: (kind: RecipeKindFilter) => void;
	onCategoryChange: (category: string) => void;
}

export function RecipeCatalogFilters({
	search,
	kind,
	category,
	categories,
	onSearchChange,
	onKindChange,
	onCategoryChange,
}: RecipeCatalogFiltersProps) {
	return (
		<div className="mb-6 space-y-4">
			<SearchInput
				value={search}
				onChange={onSearchChange}
				placeholder="Search recipes, providers, actions..."
				className="max-w-xl"
			/>

			<div className="flex flex-wrap gap-2">
				{(Object.keys(recipeKindLabels) as Array<RecipeKind | "all">).map((nextKind) => (
					<Button
						key={nextKind}
						variant={kind === nextKind ? "primary" : "secondary"}
						size="sm"
						onClick={() => onKindChange(nextKind)}
					>
						{recipeKindLabels[nextKind]}
					</Button>
				))}
			</div>

			<div className="flex flex-wrap gap-2">
				{categories.map((nextCategory) => (
					<button
						key={nextCategory}
						type="button"
						onClick={() => onCategoryChange(nextCategory)}
						className={cn(
							"rounded-md border px-3 py-1.5 text-sm transition-colors",
							category === nextCategory
								? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
								: "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
						)}
					>
						{nextCategory}
					</button>
				))}
			</div>
		</div>
	);
}
