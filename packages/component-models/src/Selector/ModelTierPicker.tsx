import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  DEFAULT_MODEL_TIER,
  formatReasoningLabel,
  getModelDisplayName,
  getModelTierDefinition,
  isLineupEligibleModel,
  isTextInputChatModel,
  MODEL_TIER_DEFINITIONS,
  MODEL_TIER_ROLE_DEFINITIONS,
  MODEL_TIER_ROLES,
  resolveModelTierSelection,
  type ModelConfigItem,
  type ModelLineupRuntime,
  type ModelTier,
  type ModelTierRole,
  type ResolvedLineupCandidate,
} from "@ngriffin_uk/polychat-schemas";
import { Check, Crown, Rocket, Sparkles, Wand2, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { ModelIcon } from "../ModelIcon/ModelIcon";

export const INHERITED_MODEL_TIER = "inherit";

export type ModelTierChoice = ModelTier | typeof INHERITED_MODEL_TIER;

export interface ModelTierSelection {
  tier: ModelTier | null;
  agent: ResolvedLineupCandidate | null;
}

interface ModelTierPickerProps {
  models: ModelConfigItem[];
  runtime: ModelLineupRuntime;
  selectedTier: ModelTier | null;
  allowInherit?: boolean;
  disabled?: boolean;
  onSelectTier: (selection: ModelTierSelection) => void;
}

export function getModelTierIcon(tier: ModelTier | null) {
  switch (tier) {
    case "low":
      return Zap;
    case "medium":
      return Sparkles;
    case "high":
      return Rocket;
    case "ultra":
      return Crown;
    default:
      return Wand2;
  }
}

export function getModelTierLabel(tier: ModelTier | null) {
  return tier ? getModelTierDefinition(tier).label : "Default";
}

function getTierTone(tier: ModelTier | null) {
  switch (tier) {
    case "low":
      return {
        icon: "bg-success/12 text-success",
        selected: "border-success/45 bg-success/12 text-success",
        check: "text-success",
        panelIcon: "border-success/45 bg-success/12 text-success",
      };
    case "medium":
      return {
        icon: "bg-active-work/12 text-active-work",
        selected: "border-active-work/45 bg-active-work/12 text-active-work",
        check: "text-active-work",
        panelIcon: "border-active-work/45 bg-active-work/12 text-active-work",
      };
    case "high":
      return {
        icon: "bg-attention/12 text-attention",
        selected: "border-attention/45 bg-attention/12 text-attention",
        check: "text-attention",
        panelIcon: "border-attention/45 bg-attention/12 text-attention",
      };
    case "ultra":
      return {
        icon: "bg-failure/12 text-failure",
        selected: "border-failure/45 bg-failure/12 text-failure",
        check: "text-failure",
        panelIcon: "border-failure/45 bg-failure/12 text-failure",
      };
    default:
      return {
        icon: "bg-creative/12 text-creative",
        selected: "border-creative/45 bg-creative/12 text-creative",
        check: "text-creative",
        panelIcon: "border-creative/45 bg-creative/12 text-creative",
      };
  }
}

export function toModelRecord(models: ModelConfigItem[]): Record<string, ModelConfigItem> {
  return Object.fromEntries(models.map((model) => [model.id ?? model.matchingModel, model]));
}

export function resolveTierRole(
  models: Record<string, ModelConfigItem>,
  runtime: ModelLineupRuntime,
  tier: ModelTier,
  role: ModelTierRole,
) {
  return resolveModelTierSelection(models, runtime, tier, role, {
    isEligible: (model) => isLineupEligibleModel(model) && isTextInputChatModel(model),
  });
}

function TierRoleRow({
  role,
  selection,
}: {
  role: ModelTierRole;
  selection: ResolvedLineupCandidate | null;
}) {
  const definition = MODEL_TIER_ROLE_DEFINITIONS[role];

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{definition.label}</p>
        <p className="text-[11px] leading-4 text-muted-foreground">{definition.description}</p>
      </div>
      {selection ? (
        <div className="flex min-w-0 shrink-0 flex-col items-end gap-1 text-right">
          <span className="inline-flex max-w-[12rem] items-center gap-1.5 text-xs font-medium text-foreground">
            <ModelIcon
              url={selection.config.avatarUrl}
              modelName={getModelDisplayName(selection.config)}
              provider={selection.config.provider}
              size={13}
            />
            <span className="truncate">{getModelDisplayName(selection.config)}</span>
          </span>
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            {selection.config.provider}
            {selection.effort ? ` · ${formatReasoningLabel(selection.effort)}` : ""}
          </span>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">Not on your plan yet</span>
      )}
    </div>
  );
}

function TierDetail({
  tier,
  models,
  runtime,
}: {
  tier: ModelTier | null;
  models: Record<string, ModelConfigItem>;
  runtime: ModelLineupRuntime;
}) {
  const effectiveTier = tier ?? DEFAULT_MODEL_TIER;
  const definition = getModelTierDefinition(effectiveTier);
  const Icon = getModelTierIcon(tier);
  const tone = getTierTone(tier);
  const description =
    tier === null
      ? "Follows the project's default tier in Work, otherwise Medium."
      : definition.description;

  return (
    <div className="flex min-h-[17rem] flex-col rounded-lg border border-border bg-surface p-4">
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
          <h4 className="text-sm font-semibold text-foreground">{getModelTierLabel(tier)}</h4>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-border">
        {MODEL_TIER_ROLES.map((role) => (
          <TierRoleRow
            key={role}
            role={role}
            selection={resolveTierRole(models, runtime, effectiveTier, role)}
          />
        ))}
      </div>
      <p className="mt-auto pt-3 text-[11px] leading-4 text-muted-foreground">
        The first model your plan can run wins. Add a provider key to move up the lineup.
      </p>
    </div>
  );
}

export function ModelTierPicker({
  models,
  runtime,
  selectedTier,
  allowInherit = true,
  disabled,
  onSelectTier,
}: ModelTierPickerProps) {
  const record = useMemo(() => toModelRecord(models), [models]);
  const [previewTier, setPreviewTier] = useState<ModelTierChoice | null>(null);
  const choices: Array<ModelTier | null> = [
    ...(allowInherit ? [null] : []),
    ...MODEL_TIER_DEFINITIONS.map((definition) => definition.id),
  ];
  const detailTier =
    previewTier === null ? selectedTier : previewTier === INHERITED_MODEL_TIER ? null : previewTier;

  return (
    <div className="grid min-h-0 gap-3 p-3 md:grid-cols-[minmax(12rem,0.82fr)_minmax(16rem,1.18fr)]">
      <div className="space-y-1.5">
        {choices.map((tier) => {
          const Icon = getModelTierIcon(tier);
          const isSelected = tier === selectedTier;
          const tone = getTierTone(tier);
          const label = getModelTierLabel(tier);
          const tagline = tier
            ? getModelTierDefinition(tier).tagline
            : "Project or account default";
          const hasTeammate = Boolean(
            resolveTierRole(record, runtime, tier ?? DEFAULT_MODEL_TIER, "agent"),
          );
          const isChoiceDisabled = disabled || !hasTeammate;

          return (
            <button
              key={tier ?? INHERITED_MODEL_TIER}
              type="button"
              role="option"
              aria-label={`${label} tier`}
              aria-selected={isSelected}
              aria-disabled={isChoiceDisabled}
              disabled={isChoiceDisabled}
              onMouseEnter={() => setPreviewTier(tier ?? INHERITED_MODEL_TIER)}
              onFocus={() => setPreviewTier(tier ?? INHERITED_MODEL_TIER)}
              onMouseLeave={() => setPreviewTier(null)}
              onBlur={() => setPreviewTier(null)}
              onClick={() =>
                onSelectTier({
                  tier,
                  agent: resolveTierRole(record, runtime, tier ?? DEFAULT_MODEL_TIER, "agent"),
                })
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? tone.selected
                  : "border-transparent bg-surface-elevated text-foreground hover:border-border-strong hover:bg-selection/60",
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
                <span className="block text-sm font-semibold">{label}</span>
                <span
                  className={cn(
                    "block truncate text-xs",
                    isSelected ? "text-current opacity-75" : "text-muted-foreground",
                  )}
                >
                  {tagline}
                </span>
              </span>
              {isSelected ? (
                <Check className={cn("h-4 w-4 flex-shrink-0", tone.check)} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <TierDetail tier={detailTier} models={record} runtime={runtime} />
    </div>
  );
}
