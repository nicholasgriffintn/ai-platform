import { toolCategories, type Tool, type ToolCategory } from "@ngriffin_uk/polychat-schemas";

export type ToolCategoryFilter = "all" | "selected" | ToolCategory;

interface ToolFilterOptions {
  category: ToolCategoryFilter;
  query: string;
  selectedToolIds: readonly string[];
}

export function getAvailableToolCategories(tools: readonly Tool[]): ToolCategory[] {
  const availableCategories = new Set(tools.map((tool) => tool.category));

  return toolCategories.filter((category) => availableCategories.has(category));
}

export function getSelectedCatalogToolIds(
  tools: readonly Tool[],
  selectedToolIds: readonly string[],
): string[] {
  const catalogToolIds = new Set(tools.map((tool) => tool.id));

  return selectedToolIds.filter((toolId) => catalogToolIds.has(toolId));
}

export function filterTools(
  tools: readonly Tool[],
  { category, query, selectedToolIds }: ToolFilterOptions,
): Tool[] {
  const normalisedQuery = query.trim().toLocaleLowerCase();
  const selectedTools = new Set(selectedToolIds);

  return tools.filter((tool) => {
    const matchesCategory =
      category === "all" ||
      (category === "selected" && selectedTools.has(tool.id)) ||
      tool.category === category;

    if (!matchesCategory) {
      return false;
    }

    if (!normalisedQuery) {
      return true;
    }

    return [tool.name, tool.id, tool.description, tool.category].some((value) =>
      value.toLocaleLowerCase().includes(normalisedQuery),
    );
  });
}
