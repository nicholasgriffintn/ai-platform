import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  getModelDisplayName,
  hasProviderReasoningOptions,
  isStealthModel,
  type ModelRegionOption,
  modelSupportsVisualModality,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import {
  AudioWaveform,
  BrainCircuit,
  ChevronDown,
  Code2,
  Crown,
  Eye,
  Globe2,
  Hammer,
  Info,
  Search,
  Sparkles,
} from "lucide-react";

import { ModelIcon } from "../ModelIcon/ModelIcon";

interface ModelOptionProps {
  model: ModelConfigItem;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  mono?: boolean;
  regionOptions?: ModelRegionOption[];
  selectedRegionModelId?: string;
  onRegionSelect?: (modelId: string) => void;
  onInfoHoverStart?: (model: ModelConfigItem, anchorRect: DOMRect) => void;
  onInfoHoverEnd?: () => void;
}

export const ModelOption = ({
  model,
  isSelected,
  isActive,
  onClick,
  disabled,
  mono = false,
  regionOptions = [],
  selectedRegionModelId,
  onRegionSelect,
  onInfoHoverStart,
  onInfoHoverEnd,
}: ModelOptionProps) => {
  const showDetailsTrigger = Boolean(
    model.description ||
    (model.strengths && model.strengths.length > 0) ||
    model.contextWindow ||
    model.maxTokens ||
    model.artificialAnalysis,
  );
  const canShowHoverPreview = showDetailsTrigger && Boolean(onInfoHoverStart);
  const hasRegionOptions = regionOptions.length > 1;
  const selectModel = () => {
    if (disabled) {
      return;
    }

    onClick();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectModel();
  };

  const showModelDetails = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rowElement = event.currentTarget.closest("[data-model-option-row]");
    const anchorElement = rowElement instanceof HTMLElement ? rowElement : event.currentTarget;

    onInfoHoverStart?.(model, anchorElement.getBoundingClientRect());
  };

  return (
    <div
      role="option"
      tabIndex={disabled ? -1 : 0}
      data-model-option
      data-model-option-row
      aria-disabled={disabled || undefined}
      aria-selected={isSelected}
      onClick={selectModel}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-active-work/40",
        !disabled ? "cursor-pointer" : "cursor-not-allowed border-border/60 opacity-50",
        isSelected
          ? "border-creative/45 bg-creative/12"
          : isActive
            ? "border-active-work/40 bg-selection"
            : "border-transparent hover:border-border-strong hover:bg-surface-elevated",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
            <ModelIcon
              url={model.avatarUrl}
              mono={mono}
              modelName={getModelDisplayName(model)}
              provider={model.provider}
              size={20}
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-h-[1.4rem] flex-wrap items-center gap-1.5">
              <span className="block min-w-0 font-medium text-foreground whitespace-normal break-words">
                {getModelDisplayName(model)}
              </span>
              {!model.isFree && !model.isByokEnabled && (
                <div className="rounded-full bg-creative/12 p-0.5" title="Pro">
                  <Crown size={12} className="text-creative" />
                </div>
              )}
              {model.isByokEnabled ? (
                <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium leading-none text-success">
                  BYOK
                </span>
              ) : null}
              {isStealthModel(model) ? (
                <span className="rounded-full bg-attention/12 px-1.5 py-0.5 text-[10px] font-medium leading-none text-attention">
                  Stealth
                </span>
              ) : null}
            </div>
            {model.description ? (
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground whitespace-normal break-words">
                {model.description}
              </p>
            ) : null}
            {model.readiness && model.readiness.state !== "ready" ? (
              <p className="mt-1 text-xs font-medium leading-5 text-attention whitespace-normal break-words">
                {model.readiness.reason}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 pl-[2.6rem] sm:w-[124px] sm:flex-shrink-0 sm:justify-end sm:pl-0">
          {hasRegionOptions && (
            <label
              className="relative flex max-w-[112px] items-center"
              title="Region"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Globe2
                size={12}
                className="pointer-events-none absolute left-1.5 text-muted-foreground"
              />
              <select
                aria-label={`Select region for ${getModelDisplayName(model)}`}
                value={selectedRegionModelId || model.id}
                disabled={disabled}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();
                  onRegionSelect?.(event.target.value);
                }}
                className="border-border bg-surface text-foreground focus:border-active-work h-6 w-full cursor-pointer appearance-none rounded-full border py-0 pr-5 pl-5 text-[11px] font-medium focus:outline-none"
              >
                {regionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={10}
                className="pointer-events-none absolute right-1.5 text-muted-foreground"
              />
            </label>
          )}
          {hasProviderReasoningOptions(model) && (
            <div className="rounded-full bg-active-work/12 p-1" title="Reasoning">
              <BrainCircuit size={12} className="text-active-work" />
            </div>
          )}
          {model.supportsToolCalls && (
            <div className="rounded-full bg-attention/12 p-1" title="Tool Calling">
              <Hammer size={12} className="text-attention" />
            </div>
          )}
          {modelSupportsVisualModality(model) && (
            <div className="rounded-full bg-active-work/12 p-1">
              <Eye size={12} className="text-active-work" />
            </div>
          )}
          {model.supportsSearchGrounding && (
            <div className="rounded-full bg-attention/12 p-1">
              <Search size={12} className="text-attention" />
            </div>
          )}
          {model.supportsCodeExecution && (
            <div className="rounded-full bg-success/12 p-1">
              <Code2 size={12} className="text-success" />
            </div>
          )}
          {model.supportsAudio && (
            <div className="rounded-full bg-success/12 p-1">
              <AudioWaveform size={12} className="text-success" />
            </div>
          )}
          {model.isFeatured && (
            <div className="rounded-full bg-failure/12 p-1">
              <Sparkles size={12} className="text-failure" />
            </div>
          )}
          {canShowHoverPreview && (
            <Button
              variant="icon"
              size="xs"
              className="cursor-help rounded-full"
              onClick={showModelDetails}
              onFocus={showModelDetails}
              onMouseEnter={showModelDetails}
              onBlur={() => onInfoHoverEnd?.()}
              aria-label="View model details"
            >
              <Info size={13} className="text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
