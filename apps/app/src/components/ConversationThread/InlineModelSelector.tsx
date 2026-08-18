import { InlineModelPicker } from "@ngriffin_uk/polychat-component-models";
import { useMemo, useState } from "react";

import { useConversationModelOptions } from "~/hooks/useConversationModelOptions";

interface InlineModelSelectorProps {
  onModelSelect: (modelId: string) => void;
  onCancel: () => void;
  className?: string;
}

export const InlineModelSelector = ({
  onModelSelect,
  className = "",
}: InlineModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { currentModel, featuredModels, isLoading, searchModels } = useConversationModelOptions({
    excludeCurrentModel: true,
  });
  const searchResults = useMemo(() => searchModels(searchQuery), [searchModels, searchQuery]);

  return (
    <InlineModelPicker
      isOpen={isOpen}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      currentModel={currentModel}
      featuredModels={featuredModels}
      searchResults={searchResults}
      isLoading={isLoading}
      className={className}
      onSelect={(modelId) => {
        setIsOpen(false);
        onModelSelect(modelId);
      }}
    />
  );
};
