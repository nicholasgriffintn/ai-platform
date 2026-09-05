import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  getModelDisplayName,
  AUTO_ROUTER_MODES,
  countAutoRouterModeCandidates,
  getAutoRouterModeCandidates,
  type AutoRouterModeDefinition,
  type ModelConfigItem,
  type ModelRouterMode,
} from "@ngriffin_uk/polychat-schemas";
import { Check, Crown, Gauge, Network, Rocket, Sparkles, Wand2, Zap } from "lucide-react";
import { useState } from "react";

import { ModelIcon } from "../ModelIcon/ModelIcon";

interface AutoModePickerProps {
  models: ModelConfigItem[];
  selectedMode: ModelRouterMode;
  disabled?: boolean;
  onSelectMode: (mode: ModelRouterMode) => void;
}

export function getAutoRouterModeIcon(mode: ModelRouterMode) {
  switch (mode) {
    case "lite":
      return Zap;
    case "standard":
      return Sparkles;
    case "pro":
      return Rocket;
    case "max":
      return Crown;
    case "auto":
      return Wand2;
  }
}

function getModeTone(mode: ModelRouterMode) {
  switch (mode) {
    case "auto":
      return {
        icon: "bg-creative/12 text-creative",
        selected: "border-creative/45 bg-creative/12 text-creative",
        check: "text-creative",
        panelIcon: "border-creative/45 bg-creative/12 text-creative",
        panelCard: "border-creative/45 bg-creative/12",
        panelLabel: "text-creative",
      };
    case "lite":
      return {
        icon: "bg-active-work/12 text-active-work",
        selected: "border-active-work/45 bg-active-work/12 text-active-work",
        check: "text-active-work",
        panelIcon: "border-active-work/45 bg-active-work/12 text-active-work",
        panelCard: "border-active-work/45 bg-active-work/12",
        panelLabel: "text-active-work",
      };
    case "standard":
      return {
        icon: "bg-success/12 text-success",
        selected: "border-success/45 bg-success/12 text-success",
        check: "text-success",
        panelIcon: "border-success/45 bg-success/12 text-success",
        panelCard: "border-success/45 bg-success/12",
        panelLabel: "text-success",
      };
    case "pro":
      return {
        icon: "bg-attention/12 text-attention",
        selected: "border-attention/45 bg-attention/12 text-attention",
        check: "text-attention",
        panelIcon: "border-attention/45 bg-attention/12 text-attention",
        panelCard: "border-attention/45 bg-attention/12",
        panelLabel: "text-attention",
      };
    case "max":
      return {
        icon: "bg-failure/12 text-failure",
        selected: "border-failure/45 bg-failure/12 text-failure",
        check: "text-failure",
        panelIcon: "border-failure/45 bg-failure/12 text-failure",
        panelCard: "border-failure/45 bg-failure/12",
        panelLabel: "text-failure",
      };
  }
}

function getCandidateText(count: number) {
  return `${count} candidate${count === 1 ? "" : "s"}`;
}

function ModeDetail({
  mode,
  models,
}: {
  mode: AutoRouterModeDefinition;
  models: ModelConfigItem[];
}) {
  const candidateCount = countAutoRouterModeCandidates(models, mode.id);
  const candidates = getAutoRouterModeCandidates(models, mode.id);
  const exampleModels = candidates.slice(0, 3);
  const remainingModelCount = Math.max(0, candidates.length - exampleModels.length);
  const Icon = getAutoRouterModeIcon(mode.id);
  const tone = getModeTone(mode.id);

  return (
    <div className="border-border bg-surface flex min-h-[17rem] flex-col rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border",
            tone.panelIcon,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{mode.label}</h4>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{mode.description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className={cn("rounded-md border p-2", tone.panelCard)}>
          <div className={cn("flex items-center gap-1.5", tone.panelLabel)}>
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filter</span>
          </div>
          <p className="mt-1 font-semibold text-foreground">{mode.filterSummary}</p>
        </div>
        <div className={cn("rounded-md border p-2", tone.panelCard)}>
          <div className={cn("flex items-center gap-1.5", tone.panelLabel)}>
            <Network className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Router pool</span>
          </div>
          <p className="mt-1 font-semibold text-foreground">{getCandidateText(candidateCount)}</p>
        </div>
      </div>

      <div className="mt-auto pt-4">
        {exampleModels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {exampleModels.map((model) => {
              const modelName = getModelDisplayName(model);

              return (
                <span
                  key={`${mode.id}-${model.id || model.matchingModel}`}
                  className="border-border bg-surface-elevated text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium"
                  title={`${modelName} (${model.provider})`}
                >
                  <ModelIcon
                    url={model.avatarUrl}
                    modelName={modelName}
                    provider={model.provider}
                    size={13}
                  />
                  <span className="min-w-0 max-w-32 truncate">{modelName}</span>
                </span>
              );
            })}
            {remainingModelCount > 0 ? (
              <span className="inline-flex items-center rounded-full border border-dashed border-border-strong px-2 py-1 text-[11px] font-medium text-muted-foreground">
                +{remainingModelCount} more...
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No matching router models are available.</p>
        )}
      </div>
    </div>
  );
}

export function AutoModePicker({
  models,
  selectedMode,
  disabled,
  onSelectMode,
}: AutoModePickerProps) {
  const selectedDefinition =
    AUTO_ROUTER_MODES.find((mode) => mode.id === selectedMode) ?? AUTO_ROUTER_MODES[0];
  const [previewMode, setPreviewMode] = useState<ModelRouterMode | null>(null);
  const previewDefinition =
    AUTO_ROUTER_MODES.find((mode) => mode.id === previewMode) ?? selectedDefinition;

  return (
    <div className="grid min-h-0 gap-3 p-3 md:grid-cols-[minmax(12rem,0.82fr)_minmax(16rem,1.18fr)]">
      <div className="space-y-1.5">
        {AUTO_ROUTER_MODES.map((mode) => {
          const Icon = getAutoRouterModeIcon(mode.id);
          const isSelected = mode.id === selectedDefinition.id;
          const candidateCount = countAutoRouterModeCandidates(models, mode.id);
          const isModeDisabled = disabled || candidateCount === 0;
          const tone = getModeTone(mode.id);

          return (
            <button
              key={mode.id}
              type="button"
              role="option"
              aria-label={`${mode.label} automatic mode`}
              aria-selected={isSelected}
              aria-disabled={isModeDisabled}
              disabled={isModeDisabled}
              onMouseEnter={() => setPreviewMode(mode.id)}
              onFocus={() => setPreviewMode(mode.id)}
              onMouseLeave={() => setPreviewMode(null)}
              onBlur={() => setPreviewMode(null)}
              onClick={() => onSelectMode(mode.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? tone.selected
                  : "bg-surface-elevated text-foreground hover:border-border-strong hover:bg-selection/60 border-transparent",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
                  tone.icon,
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{mode.label}</span>
                <span
                  className={cn(
                    "block truncate text-xs",
                    isSelected ? "text-current opacity-75" : "text-muted-foreground",
                  )}
                >
                  {mode.tagline}
                </span>
              </span>
              {isSelected ? (
                <Check className={cn("h-4 w-4 flex-shrink-0", tone.check)} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <ModeDetail mode={previewDefinition} models={models} />
    </div>
  );
}
