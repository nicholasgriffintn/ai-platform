import type { AssistantActionItem, ProjectCapabilityKind } from "@assistant/schemas";

export type ProjectCapabilityKindFilter = "all" | ProjectCapabilityKind;

export interface ProjectCapabilityCategoryGroup {
	category: string;
	items: AssistantActionItem[];
}

export interface ProjectCapabilityKindGroup {
	categories: ProjectCapabilityCategoryGroup[];
	kind: ProjectCapabilityKind;
	label: string;
}

const KIND_LABELS: Record<ProjectCapabilityKind, string> = {
	app: "Apps",
	recipe: "Recipes",
	tool: "Tools",
};

const KIND_ORDER: ProjectCapabilityKind[] = ["app", "recipe", "tool"];

export function getProjectCapabilityKind(item: AssistantActionItem): ProjectCapabilityKind | null {
	if (item.kind === "app") return "app";
	if (item.kind === "recipe" || item.kind === "installed_recipe") return "recipe";
	if (item.kind === "tool") return "tool";
	return null;
}

export function getProjectCapabilityCategory(item: AssistantActionItem): string {
	return item.metadata?.category?.trim() || "Other";
}

export function getProjectCapabilityCategories(
	items: AssistantActionItem[],
	kind: ProjectCapabilityKindFilter,
): string[] {
	return Array.from(
		new Set(
			items
				.filter((item) => kind === "all" || getProjectCapabilityKind(item) === kind)
				.map(getProjectCapabilityCategory),
		),
	).sort((left, right) => {
		if (left === "Other") return 1;
		if (right === "Other") return -1;
		return left.localeCompare(right);
	});
}

export function filterProjectCapabilities(
	items: AssistantActionItem[],
	filters: {
		category: string;
		kind: ProjectCapabilityKindFilter;
		query: string;
	},
): AssistantActionItem[] {
	const query = filters.query.trim().toLocaleLowerCase();

	return items.filter((item) => {
		const kind = getProjectCapabilityKind(item);
		if (!kind || (filters.kind !== "all" && kind !== filters.kind)) return false;

		const category = getProjectCapabilityCategory(item);
		if (filters.category !== "all" && category !== filters.category) return false;
		if (!query) return true;

		return [item.label, item.description, category, ...item.searchText]
			.filter((value): value is string => Boolean(value))
			.some((value) => value.toLocaleLowerCase().includes(query));
	});
}

export function groupProjectCapabilities(
	items: AssistantActionItem[],
): ProjectCapabilityKindGroup[] {
	return KIND_ORDER.flatMap((kind) => {
		const kindItems = items.filter((item) => getProjectCapabilityKind(item) === kind);
		if (kindItems.length === 0) return [];

		const categories = getProjectCapabilityCategories(kindItems, kind).map((category) => ({
			category,
			items: kindItems
				.filter((item) => getProjectCapabilityCategory(item) === category)
				.sort((left, right) => left.label.localeCompare(right.label)),
		}));

		return [{ categories, kind, label: KIND_LABELS[kind] }];
	});
}
