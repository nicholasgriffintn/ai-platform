import { SearchInput } from "~/components/ui";
import type { ProjectCapabilityKindFilter } from "~/lib/project-capability-catalog";
import { cn } from "~/lib/utils";

const KIND_FILTERS: Array<{ label: string; value: ProjectCapabilityKindFilter }> = [
	{ label: "All", value: "all" },
	{ label: "Apps", value: "app" },
	{ label: "Recipes", value: "recipe" },
	{ label: "Tools", value: "tool" },
];

interface ProjectCapabilityFiltersProps {
	categories: string[];
	category: string;
	kind: ProjectCapabilityKindFilter;
	onCategoryChange: (category: string) => void;
	onKindChange: (kind: ProjectCapabilityKindFilter) => void;
	onQueryChange: (query: string) => void;
	query: string;
}

export function ProjectCapabilityFilters({
	categories,
	category,
	kind,
	onCategoryChange,
	onKindChange,
	onQueryChange,
	query,
}: ProjectCapabilityFiltersProps) {
	return (
		<div className="mb-8 space-y-3">
			<SearchInput
				aria-label="Search project capabilities"
				className="max-w-xl"
				placeholder="Search apps, recipes, and tools..."
				value={query}
				onChange={onQueryChange}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<div
					className="flex flex-wrap gap-1.5"
					aria-label="Filter capabilities by type"
					role="group"
				>
					{KIND_FILTERS.map((filter) => (
						<button
							key={filter.value}
							type="button"
							aria-pressed={kind === filter.value}
							onClick={() => onKindChange(filter.value)}
							className={cn(
								"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
								kind === filter.value
									? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
									: "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
							)}
						>
							{filter.label}
						</button>
					))}
				</div>
				<span className="hidden h-6 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" />
				<div
					className="flex max-w-full gap-1.5 overflow-x-auto pb-1"
					aria-label="Filter capabilities by category"
					role="group"
				>
					{["all", ...categories].map((capabilityCategory) => (
						<button
							key={capabilityCategory}
							type="button"
							aria-pressed={category === capabilityCategory}
							onClick={() => onCategoryChange(capabilityCategory)}
							className={cn(
								"shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
								category === capabilityCategory
									? "border-zinc-400 bg-zinc-100 text-zinc-950 dark:border-zinc-500 dark:bg-zinc-800 dark:text-white"
									: "border-transparent text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
							)}
						>
							{capabilityCategory === "all" ? "All categories" : capabilityCategory}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
