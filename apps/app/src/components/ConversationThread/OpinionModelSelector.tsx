import { OpinionModelPicker } from "@ngriffin_uk/polychat-component-models";
import type { OpinionMode, OpinionRequest } from "@ngriffin_uk/polychat-library-chat/opinion";
import { useEffect, useMemo, useState } from "react";

import { useConversationModelOptions } from "~/hooks/useConversationModelOptions";

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
    <OpinionModelPicker
      mode={mode}
      onModeChange={toggleMode}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      featuredModels={featuredModels}
      searchResults={searchResults}
      selectedModelIds={selectedModelIds}
      onToggleModel={toggleModel}
      maxConsensusModels={MAX_CONSENSUS_MODELS}
      isLoading={isLoading}
      submitDisabled={submitDisabled}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      className={className}
    />
  );
}
