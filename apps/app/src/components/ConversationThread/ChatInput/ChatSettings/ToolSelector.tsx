import { ToolSelectorPopover } from "@ngriffin_uk/polychat-component-conversation";
import {
  filterTools,
  getAvailableToolCategories,
  type ToolCategoryFilter,
} from "@ngriffin_uk/polychat-library-chat/tool-filters";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTools } from "~/hooks/useTools";
import { useToolsStore } from "~/state/stores/toolsStore";

export const ToolSelector = ({ isDisabled = false }: { isDisabled?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategoryFilter>("all");
  const { data: toolsData, isLoading } = useTools();
  const { selectedTools, toggleTool, resetToDefaults, defaultTools, setDefaultTools } =
    useToolsStore();
  const hasInitialisedDefaultTools = useRef(defaultTools.length > 0);

  const tools = toolsData || [];
  const categories = useMemo(() => getAvailableToolCategories(tools), [tools]);
  const visibleTools = useMemo(
    () =>
      filterTools(tools, {
        category,
        query,
        selectedToolIds: selectedTools,
      }),
    [category, query, selectedTools, tools],
  );

  useEffect(() => {
    if (hasInitialisedDefaultTools.current || tools.length === 0) {
      return;
    }

    hasInitialisedDefaultTools.current = true;
    setDefaultTools(tools);
  }, [setDefaultTools, tools]);

  const handleOpenChange = (nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen);
    if (!nextIsOpen) {
      setQuery("");
      setCategory("all");
    }
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
  };

  return (
    <ToolSelectorPopover
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      isDisabled={isDisabled}
      isLoading={isLoading}
      tools={tools}
      visibleTools={visibleTools}
      categories={categories}
      category={category}
      onCategoryChange={setCategory}
      query={query}
      onQueryChange={setQuery}
      onResetFilters={resetFilters}
      selectedTools={selectedTools}
      defaultTools={defaultTools}
      onToggleTool={toggleTool}
      onResetToDefaults={resetToDefaults}
    />
  );
};
