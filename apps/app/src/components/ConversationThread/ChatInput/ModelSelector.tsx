import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Computer,
  Crown,
  Eye,
  Hammer,
  Info,
  Loader2,
  Search,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { Select, TextInput } from "~/components/ui";
import { useModels } from "~/hooks/useModels";
import {
  getAvailableModels,
  getFeaturedModelIds,
  getModelsByMode,
} from "~/lib/models";
import { defaultModel } from "~/lib/models";
import {
  useIsLoading,
  useLoadingMessage,
  useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ModelConfigItem } from "~/types";

interface ModelSelectorProps {
  isDisabled?: boolean;
  minimal?: boolean;
  mono?: boolean;
}

export const ModelSelector = ({
  isDisabled,
  minimal = false,
  mono = false,
}: ModelSelectorProps) => {
  const {
    isPro,
    model,
    setModel,
    chatMode,
    setChatMode,
    chatSettings,
    setChatSettings,
  } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllModels, setShowAllModels] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(
    null,
  );
  const [activeDescendantId, setActiveDescendantId] = useState<string | null>(
    null,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const { data: apiModels = {}, isLoading: isLoadingModels } = useModels();
  const isModelLoading = useIsLoading("model-init");
  const modelLoadingProgress = useLoadingProgress("model-init");
  const modelLoadingMessage = useLoadingMessage("model-init");

  const availableModels = getAvailableModels(apiModels);
  const featuredModelIds = getFeaturedModelIds(availableModels);

  const filteredModels = getModelsByMode(availableModels, chatMode);

  useEffect(() => {
    if (searchQuery || selectedCapability) {
      setShowAllModels(true);
    }
  }, [searchQuery, selectedCapability]);

  const selectedModelInfo = filteredModels[model || defaultModel];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggleModelSource = () => {
    const newChatMode = chatMode === "local" ? "remote" : "local";
    setChatMode(newChatMode);

    if (newChatMode === "local") {
      // When switching to local, set localOnly to true and clear model
      setChatSettings({
        ...chatSettings,
        localOnly: true,
      });
      setModel("");
    } else {
      // When switching to remote, set localOnly to false and set default model
      setChatSettings({
        ...chatSettings,
        localOnly: false,
      });
      setModel(defaultModel);
    }
  };

  const featuredModels = Object.values(filteredModels).filter((model) => {
    return featuredModelIds[model.id];
  });

  const otherModels = Object.values(filteredModels).filter(
    (model) => !featuredModelIds[model.id],
  );

  const groupModelsByProvider = (models: ModelConfigItem[]) => {
    return models.reduce(
      (acc, model) => {
        const provider = model.provider || "unknown";
        if (!acc[provider]) {
          acc[provider] = [];
        }
        acc[provider].push(model);
        return acc;
      },
      {} as Record<string, ModelConfigItem[]>,
    );
  };

  const groupedFeaturedModels = groupModelsByProvider(featuredModels);
  const groupedOtherModels = groupModelsByProvider(otherModels);

  const capabilities = Array.from(
    new Set(
      Object.values(filteredModels).flatMap((model) => model.strengths || []),
    ),
  ).sort();

  const capabilityOptions = [
    { value: "", label: "All capabilities" },
    ...capabilities.map((capability) => ({
      value: capability,
      label: capability,
    })),
  ];

  const filterModels = (models: Record<string, ModelConfigItem[]>) => {
    const result: Record<string, ModelConfigItem[]> = {};

    for (const [provider, providerModels] of Object.entries(models)) {
      const filtered = providerModels.filter((model) => {
        const matchesSearch =
          searchQuery === "" ||
          (
            model.name?.toLowerCase() || model.matchingModel.toLowerCase()
          ).includes(searchQuery.toLowerCase()) ||
          (model.description?.toLowerCase() || "").includes(
            searchQuery.toLowerCase(),
          );

        const matchesCapability =
          !selectedCapability ||
          model.strengths?.includes(selectedCapability) ||
          false;

        return matchesSearch && matchesCapability;
      });

      if (filtered.length > 0) {
        result[provider] = filtered;
      }
    }

    return result;
  };

  const filteredFeaturedModels = filterModels(groupedFeaturedModels);
  const filteredOtherModels = filterModels(groupedOtherModels);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!isOpen) return;

    const allVisibleModels = Object.values(filteredFeaturedModels)
      .concat(showAllModels ? Object.values(filteredOtherModels) : [])
      .flat();

    const currentIndex = activeDescendantId
      ? allVisibleModels.findIndex(
          (m) => `model-${m.matchingModel}` === activeDescendantId,
        )
      : -1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < allVisibleModels.length - 1) {
          setActiveDescendantId(
            `model-${allVisibleModels[currentIndex + 1].matchingModel}`,
          );
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          setActiveDescendantId(
            `model-${allVisibleModels[currentIndex - 1].matchingModel}`,
          );
        }
        break;
      case "Enter":
        e.preventDefault();
        if (activeDescendantId) {
          const selectedModel = allVisibleModels.find(
            (m) => `model-${m.matchingModel}` === activeDescendantId,
          );
          if (selectedModel) {
            setModel(selectedModel.id);
            setIsOpen(false);
          }
        }
        break;
    }
  };

  if (isLoadingModels) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  return (
    <div
      className="flex-1 relative min-w-0 max-w-full"
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select a model"
        className={`cursor-pointer disabled:cursor-not-allowed flex items-center gap-2 rounded-md w-full ${minimal ? "px-2 py-1" : "px-3 py-1.5"} bg-off-white-highlight dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors`}
      >
        {isModelLoading ? (
          <div className="flex items-center gap-2 w-full min-w-0">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            {!minimal && (
              <span
                className="text-sm max-w-[250px] truncate w-full"
                title={selectedModelInfo?.name || "Select model"}
              >
                {modelLoadingMessage}{" "}
                {modelLoadingProgress !== undefined &&
                  `(${modelLoadingProgress}%)`}
              </span>
            )}
          </div>
        ) : (
          <>
            <ModelIcon
              modelName={selectedModelInfo?.name || ""}
              provider={selectedModelInfo?.provider}
              size={18}
              mono={mono}
            />
            {!minimal && (
              <span
                className="text-sm max-w-[250px] truncate w-full"
                title={selectedModelInfo?.name || "Select model"}
              >
                {selectedModelInfo?.name || "Select model"}
              </span>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <dialog
          open
          className="absolute bottom-full left-0 mb-1 w-[350px] bg-off-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg z-50"
          aria-label="Model selection dialog"
        >
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <TextInput
                  ref={searchInputRef}
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  aria-label="Search models"
                />
                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search
                    className="h-4 w-4 text-zinc-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <Select
                value={selectedCapability || ""}
                onChange={(e) => setSelectedCapability(e.target.value || null)}
                options={capabilityOptions}
                aria-label="Filter by capability"
                className="text-sm"
                fullWidth={false}
              />
            </div>
          </div>

          <div
            className="max-h-[300px] overflow-y-auto"
            ref={listboxRef}
            // biome-ignore lint/a11y/useSemanticElements: This is a fancy UI
            role="listbox"
            aria-label="Available models"
            aria-activedescendant={activeDescendantId || undefined}
            tabIndex={0}
          >
            {Object.keys(filteredFeaturedModels).length <= 0 &&
              Object.keys(filteredOtherModels).length <= 0 && (
                <div className="p-2 text-center text-sm text-zinc-500">
                  No models found
                </div>
              )}

            {Object.keys(filteredFeaturedModels).length > 0 && (
              <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
                <h3
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
                  id="featured-models-heading"
                >
                  Featured Models
                </h3>
                <fieldset aria-labelledby="featured-models-heading">
                  {Object.entries(filteredFeaturedModels).map(
                    ([provider, models]) => (
                      <div key={`featured-${provider}`} className="mb-2">
                        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          {provider.charAt(0).toUpperCase() + provider.slice(1)}
                        </div>
                        {models.map((model) => {
                          const shouldModelBeDisabled =
                            isDisabled || (!isPro && model.isFree !== true);

                          return (
                            <ModelOption
                              key={model.matchingModel}
                              model={model}
                              isSelected={
                                model.matchingModel ===
                                selectedModelInfo?.matchingModel
                              }
                              onClick={() => {
                                if (!shouldModelBeDisabled) {
                                  setModel(model.id);
                                  setIsOpen(false);
                                }
                              }}
                              disabled={shouldModelBeDisabled}
                              isActive={
                                `model-${model.matchingModel}` ===
                                activeDescendantId
                              }
                              mono={mono}
                            />
                          );
                        })}
                      </div>
                    ),
                  )}
                </fieldset>
              </div>
            )}

            {Object.keys(filteredOtherModels).length > 0 && (
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => setShowAllModels(!showAllModels)}
                  className="cursor-pointer flex items-center justify-between w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
                  disabled={!!(searchQuery || selectedCapability)}
                  aria-expanded={showAllModels}
                  aria-controls="other-models-section"
                >
                  <span>
                    Other Models{" "}
                    {Object.values(filteredOtherModels).flat().length > 0 &&
                      `(${Object.values(filteredOtherModels).flat().length})`}
                  </span>
                  {showAllModels ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                <fieldset id="other-models-section" aria-label="Other models">
                  {(showAllModels || searchQuery || selectedCapability) &&
                    Object.entries(filteredOtherModels).map(
                      ([provider, models]) => (
                        <div key={`other-${provider}`} className="mb-2">
                          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                            {provider.charAt(0).toUpperCase() +
                              provider.slice(1)}
                          </div>
                          {models.map((model) => {
                            const shouldModelBeDisabled =
                              isDisabled || (!isPro && !model.isFree);

                            return (
                              <ModelOption
                                key={model.matchingModel}
                                model={model}
                                isSelected={
                                  model.matchingModel ===
                                  selectedModelInfo?.matchingModel
                                }
                                onClick={() => {
                                  if (!shouldModelBeDisabled) {
                                    setModel(model.id);
                                    setIsOpen(false);
                                  }
                                }}
                                disabled={shouldModelBeDisabled}
                                isActive={
                                  `model-${model.matchingModel}` ===
                                  activeDescendantId
                                }
                                mono={mono}
                              />
                            );
                          })}
                        </div>
                      ),
                    )}
                </fieldset>
              </div>
            )}
          </div>

          <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Model Source:
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-xs ${
                    chatMode === "remote"
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                  onClick={() =>
                    chatMode !== "remote" && handleToggleModelSource()
                  }
                  aria-pressed={chatMode === "remote"}
                >
                  Remote
                </button>
                <span className="mx-1 text-zinc-400">|</span>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-xs ${
                    chatMode === "local"
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                  onClick={() =>
                    chatMode !== "local" && handleToggleModelSource()
                  }
                  aria-pressed={chatMode === "local"}
                >
                  <Computer className="h-3 w-3" />
                  Local
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

interface ModelOptionProps {
  model: ModelConfigItem;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  mono?: boolean;
}

const ModelOption = ({
  model,
  isSelected,
  isActive,
  onClick,
  disabled,
  mono = false,
}: ModelOptionProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(!showDetails);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) {
        onClick();
      }
    }
  };

  const handleInfoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setShowDetails(!showDetails);
    }
  };

  return (
    <div
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      // biome-ignore lint/a11y/useSemanticElements: This is a fancy UI
      role="option"
      aria-selected={isSelected}
      id={`model-${model.matchingModel}`}
      tabIndex={disabled ? -1 : 0}
      className={`${!disabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"} w-full text-left px-2 py-1.5 rounded-md text-sm ${
        isSelected
          ? "bg-off-white-highlight dark:bg-zinc-800"
          : isActive
            ? "bg-zinc-50 dark:bg-zinc-800/50"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <ModelIcon
            mono={mono}
            modelName={model.name || model.matchingModel}
            provider={model.provider}
            size={20}
          />
          <span className="text-zinc-900 dark:text-zinc-100">
            {model.name || model.matchingModel}
          </span>
          {!model.isFree && (
            <div
              className="p-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30"
              title="Pro"
            >
              <Crown
                size={12}
                className="text-purple-800 dark:text-purple-300"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {model.hasThinking && (
            <div className="p-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <BrainCircuit
                size={14}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
          )}
          {model.supportsFunctions && (
            <div className="p-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Hammer
                size={14}
                className="text-amber-600 dark:text-amber-400"
              />
            </div>
          )}
          {(model.multimodal ||
            model.type?.some(
              (t) => t.includes("image-to") || t.includes("to-image"),
            )) && (
            <div className="p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
              <Eye size={14} className="text-green-600 dark:text-green-400" />
            </div>
          )}
          {(model.description ||
            (model.strengths && model.strengths.length > 0)) && (
            <button
              type="button"
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full cursor-pointer"
              onClick={handleInfoClick}
              onKeyDown={handleInfoKeyDown}
              aria-label="View model details"
              aria-pressed={showDetails}
            >
              <Info size={14} className="text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {model.description && <div className="mb-1">{model.description}</div>}
          {model.strengths && model.strengths.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {model.strengths?.map((capability) => (
                <span
                  key={`${model.matchingModel}-${capability}`}
                  className="text-xs bg-off-white-highlight dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded"
                >
                  {capability}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
