import { Button, Card, FormSelect, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import "./styles.css";

export type CapabilityKind = "app" | "recipe" | "tool";
export type CapabilityFilter = "configured" | CapabilityKind;

export interface CapabilityFiltersProps {
	categories: string[];
	category: string;
	filters: CapabilityFilter[];
	query: string;
	onCategoryChange: (category: string) => void;
	onFiltersChange: (filters: CapabilityFilter[]) => void;
	onQueryChange: (query: string) => void;
}

const capabilityFilters: Array<{ label: string; value: CapabilityFilter }> = [
	{ label: "Configured", value: "configured" },
	{ label: "Apps", value: "app" },
	{ label: "Recipes", value: "recipe" },
	{ label: "Tools", value: "tool" },
];

export function CapabilityFilters({
	categories,
	category,
	filters,
	query,
	onCategoryChange,
	onFiltersChange,
	onQueryChange,
}: CapabilityFiltersProps) {
	const categoryFilters = [
		{ label: "All categories", value: "all" },
		...categories.map((value) => ({ label: value, value })),
	];
	return (
		<div className="mb-8 space-y-4">
			<SearchInput
				aria-label="Search capabilities"
				className="max-w-xl"
				placeholder="Search apps, recipes, and tools..."
				value={query}
				onChange={onQueryChange}
			/>
			<div className="space-y-3">
				<div className="flex flex-wrap gap-1.5" aria-label="Filter capabilities" role="group">
					<button
						type="button"
						aria-pressed={filters.length === 0}
						onClick={() => onFiltersChange([])}
						className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
							filters.length === 0
								? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
								: "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
						}`}
					>
						All
					</button>
					{capabilityFilters.map((filter) => (
						<button
							key={filter.value}
							type="button"
							aria-pressed={filters.includes(filter.value)}
							onClick={() =>
								onFiltersChange(
									filters.includes(filter.value)
										? filters.filter((value) => value !== filter.value)
										: [...filters, filter.value],
								)
							}
							className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
								filters.includes(filter.value)
									? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
									: "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
							}`}
						>
							{filter.label}
						</button>
					))}
				</div>
				<div className="sm:hidden">
					<FormSelect
						aria-label="Filter capabilities by category"
						className="h-10 bg-white dark:bg-zinc-900"
						onChange={(event) => onCategoryChange(event.target.value)}
						options={categoryFilters}
						value={category}
					/>
				</div>
				<div
					className="hidden min-w-0 flex-wrap gap-1.5 sm:flex"
					aria-label="Filter capabilities by category"
					role="group"
				>
					{categoryFilters.map((filter) => (
						<button
							key={filter.value}
							type="button"
							aria-pressed={category === filter.value}
							onClick={() => onCategoryChange(filter.value)}
							className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
								category === filter.value
									? "border-zinc-400 bg-zinc-100 text-zinc-950 dark:border-zinc-500 dark:bg-zinc-800 dark:text-white"
									: "border-transparent text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
							}`}
						>
							{filter.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

export interface CapabilityCardModel {
	id: string;
	name: string;
	description: string;
	kind: CapabilityKind;
	available: boolean;
	unavailableReason?: string;
}

export function CapabilityCard({
	capability,
	installed = false,
	onLaunch,
}: {
	capability: CapabilityCardModel;
	installed?: boolean;
	onLaunch: (capability: CapabilityCardModel) => void;
}) {
	return (
		<Card className="gap-3 p-4 shadow-none">
			<header className="flex items-center justify-between text-xs capitalize text-zinc-500">
				<span>{capability.kind}</span>
				{installed && <small>Installed</small>}
			</header>
			<h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{capability.name}</h3>
			<p className="text-sm text-zinc-600 dark:text-zinc-400">{capability.description}</p>
			<Button
				size="sm"
				disabled={!capability.available}
				title={capability.unavailableReason}
				onClick={() => onLaunch(capability)}
			>
				Open
			</Button>
			{!capability.available && capability.unavailableReason && (
				<small className="text-xs text-zinc-500">{capability.unavailableReason}</small>
			)}
		</Card>
	);
}
