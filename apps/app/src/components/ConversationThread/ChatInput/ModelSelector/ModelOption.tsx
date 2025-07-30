import { BrainCircuit, Crown, Eye, Hammer, Info, Users } from "lucide-react";
import { useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import type { ModelConfigItem } from "~/types";

interface ModelOptionProps {
  model: ModelConfigItem;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  mono?: boolean;
  isTeamAgent?: boolean;
}

export const ModelOption = ({
  model,
  isSelected,
  isActive,
  onClick,
  disabled,
  mono = false,
  isTeamAgent = false,
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
      className={`${
        !disabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
      } w-full text-left px-2 py-1.5 rounded-md text-sm ${
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
            url={model.avatarUrl}
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
          {isTeamAgent ? (
            <div
              className="p-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30"
              title="Team Agent"
            >
              <Users size={12} className="text-blue-600 dark:text-blue-400" />
            </div>
          ) : null}
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
              {model.strengths?.map((capability) => {
                const isImageCapable = capability.includes("vision");
                const isCodingCapable = capability.includes("coding");
                const isReasoningCapable = capability.includes("reasoning");
                const color = isImageCapable
                  ? "green"
                  : isCodingCapable
                    ? "purple"
                    : isReasoningCapable
                      ? "blue"
                      : "yellow";
                return (
                  <span
                    key={`${model.matchingModel}-${capability}`}
                    className={`text-xs bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 px-1.5 py-0.5 rounded`}
                  >
                    {capability}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
