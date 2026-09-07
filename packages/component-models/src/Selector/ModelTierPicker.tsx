import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  DEFAULT_MODEL_TIER,
  formatReasoningLabel,
  getModelTierDefinition,
  MODEL_TIER_DEFINITIONS,
  MODEL_TIER_ROLE_DEFINITIONS,
  MODEL_TIER_ROLES,
  type ModelLineupRuntime,
  type ModelTier,
  type ModelTierRole,
  type ModelTierLineup,
  type ResolvedModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { Check, Crown, Rocket, Sparkles, Wand2, Zap } from "lucide-react";
import { useState } from "react";

import { ModelIcon } from "../ModelIcon/ModelIcon";

export const INHERITED_MODEL_TIER = "inherit";

export type ModelTierChoice = ModelTier | typeof INHERITED_MODEL_TIER;

export interface ModelTierSelection {
  tier: ModelTier | null;
  agent: ResolvedModelTier | null;
}

interface ModelTierPickerProps {
  resolved?: ModelTierLineup;
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

function getTierRoleSelection(
  resolved: ModelTierLineup | undefined,
  tier: ModelTier,
  role: ModelTierRole,
) {
  return resolved?.[tier][role] ?? null;
}

function getEmptyRoleMessage(runtime: ModelLineupRuntime) {
  switch (runtime) {
    case "browser":
      return "No matching browser model is available.";
    case "device":
      return "No matching model was discovered on this device.";
    case "machine":
      return "No matching model is available on the selected machine.";
    default:
      return "Not available on your plan yet";
  }
}

function getTierHint(runtime: ModelLineupRuntime) {
  switch (runtime) {
    case "browser":
      return "Only browser models currently available on this device are shown.";
    case "device":
      return "Only models discovered on this device are shown. Install a matching model to use this tier.";
    case "machine":
      return "Only models advertised by the selected machine are shown.";
    default:
      return "The first model your plan can run wins. Add a provider key to move up the lineup.";
  }
}

function TierRoleRow({
  role,
  selection,
  runtime,
}: {
  role: ModelTierRole;
  selection: ResolvedModelTier | null;
  runtime: ModelLineupRuntime;
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
            <ModelIcon modelName={selection.name} provider={selection.provider} size={13} />
            <span className="truncate">{selection.name}</span>
          </span>
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            {selection.provider}
            {selection.effort ? ` · ${formatReasoningLabel(selection.effort)}` : ""}
          </span>
        </div>
      ) : (
        <span className="max-w-[12rem] shrink-0 text-right text-xs text-muted-foreground">
          {getEmptyRoleMessage(runtime)}
        </span>
      )}
    </div>
  );
}

function TierDetail({
  tier,
  resolved,
  runtime,
}: {
  tier: ModelTier | null;
  resolved?: ModelTierLineup;
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
            selection={getTierRoleSelection(resolved, effectiveTier, role)}
            runtime={runtime}
          />
        ))}
      </div>
      <p className="mt-auto pt-3 text-[11px] leading-4 text-muted-foreground">
        {getTierHint(runtime)}
      </p>
    </div>
  );
}

export function ModelTierPicker({
  resolved,
  runtime,
  selectedTier,
  allowInherit = true,
  disabled,
  onSelectTier,
}: ModelTierPickerProps) {
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
          const hasAgent = tier
            ? Boolean(getTierRoleSelection(resolved, tier, "agent"))
            : Boolean(resolved?.medium.agent);
          const isChoiceDisabled = disabled || !hasAgent;

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
                  agent: tier
                    ? getTierRoleSelection(resolved, tier, "agent")
                    : (resolved?.medium.agent ?? null),
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
      <TierDetail tier={detailTier} resolved={resolved} runtime={runtime} />
    </div>
  );
}
