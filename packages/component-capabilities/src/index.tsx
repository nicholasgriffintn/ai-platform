import "./styles.css";

export type CapabilityKindFilter = "all" | "app" | "recipe" | "tool";

export interface CapabilityFiltersProps {
	categories: string[];
	category: string;
	kind: CapabilityKindFilter;
	query: string;
	onCategoryChange: (category: string) => void;
	onKindChange: (kind: CapabilityKindFilter) => void;
	onQueryChange: (query: string) => void;
}

const kindFilters: Array<{ label: string; value: CapabilityKindFilter }> = [
	{ label: "All", value: "all" },
	{ label: "Apps", value: "app" },
	{ label: "Recipes", value: "recipe" },
	{ label: "Tools", value: "tool" },
];

export function CapabilityFilters({
	categories,
	category,
	kind,
	query,
	onCategoryChange,
	onKindChange,
	onQueryChange,
}: CapabilityFiltersProps) {
	const categoryFilters = ["all", ...categories];
	return (
		<div className="polychat-capability-filters">
			<label>
				<span className="polychat-capability-visually-hidden">Search project capabilities</span>
				<input
					type="search"
					placeholder="Search apps, recipes, and tools..."
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
				/>
			</label>
			<div
				className="polychat-capability-filter-group"
				aria-label="Filter capabilities by type"
				role="group"
			>
				{kindFilters.map((filter) => (
					<button
						key={filter.value}
						type="button"
						aria-pressed={kind === filter.value}
						onClick={() => onKindChange(filter.value)}
					>
						{filter.label}
					</button>
				))}
			</div>
			<label className="polychat-capability-category-select">
				<span className="polychat-capability-visually-hidden">Filter capabilities by category</span>
				<select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
					{categoryFilters.map((value) => (
						<option key={value} value={value}>
							{value === "all" ? "All categories" : value}
						</option>
					))}
				</select>
			</label>
			<div
				className="polychat-capability-category-buttons"
				aria-label="Filter capabilities by category"
				role="group"
			>
				{categoryFilters.map((value) => (
					<button
						key={value}
						type="button"
						aria-pressed={category === value}
						onClick={() => onCategoryChange(value)}
					>
						{value === "all" ? "All categories" : value}
					</button>
				))}
			</div>
		</div>
	);
}

export interface CapabilityCardModel {
	id: string;
	name: string;
	description: string;
	kind: Exclude<CapabilityKindFilter, "all">;
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
		<article className="polychat-capability-card">
			<header>
				<span>{capability.kind}</span>
				{installed && <small>Installed</small>}
			</header>
			<h3>{capability.name}</h3>
			<p>{capability.description}</p>
			<button
				type="button"
				disabled={!capability.available}
				title={capability.unavailableReason}
				onClick={() => onLaunch(capability)}
			>
				Open
			</button>
			{!capability.available && capability.unavailableReason && (
				<small>{capability.unavailableReason}</small>
			)}
		</article>
	);
}
