import { Badge, cn } from "@ngriffin_uk/polychat-component-ui";
import type { DeploymentOption, TrainerOption } from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { VerdictBadge } from "../Registry/RegistryBadges";
import { DEPLOYMENT_SHAPE_LABELS } from "./labels";

function OptionRow({
  group,
  selected,
  disabled,
  onSelect,
  title,
  subtitle,
  price,
  priceDetail,
  badges,
  meta,
  reasons,
}: {
  group: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  price: string;
  priceDetail?: string;
  badges?: ReactNode;
  meta: readonly string[];
  reasons: readonly string[];
}) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
        selected
          ? "border-active-work bg-active-work/10 ring-1 ring-active-work"
          : "border-border hover:border-border-strong hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-transparent",
      )}
    >
      <input
        type="radio"
        name={group}
        className="sr-only"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-active-work" : "border-border-strong",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-active-work" />}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-semibold text-foreground tabular-nums">
              {price}
            </span>
            {priceDetail && (
              <span className="block text-xs text-muted-foreground tabular-nums">
                {priceDetail}
              </span>
            )}
          </span>
        </span>
        {(badges || meta.length > 0) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {badges}
            {meta.length > 0 && <span>{meta.join(" · ")}</span>}
          </span>
        )}
        {reasons.map((reason) => (
          <span key={reason} className="flex items-start gap-1.5 text-xs text-attention">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            {reason}
          </span>
        ))}
      </span>
    </label>
  );
}

function rank<T>(
  items: readonly T[],
  usable: (item: T) => boolean,
  cost: (item: T) => number | null = () => null,
) {
  return [...items].sort(
    (left, right) =>
      Number(usable(right)) - Number(usable(left)) ||
      (cost(left) ?? Number.POSITIVE_INFINITY) - (cost(right) ?? Number.POSITIVE_INFINITY),
  );
}

export function trainerOptionKey(option: TrainerOption): string {
  return `${option.provider}:${option.trainer}`;
}

function trainerUsable(option: TrainerOption): boolean {
  return option.supported && option.connected;
}

export function TrainerOptionPicker({
  options,
  selectedKey,
  onSelect,
}: {
  options: readonly TrainerOption[];
  selectedKey: string | null;
  onSelect: (option: TrainerOption) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No trainer in the catalogue supports this combination.
      </p>
    );
  }

  return (
    <div role="radiogroup" aria-label="Trainer" className="space-y-2">
      {rank(options, trainerUsable, (option) => option.estimate.usd).map((option) => (
        <OptionRow
          key={trainerOptionKey(option)}
          group="trainer"
          selected={selectedKey === trainerOptionKey(option)}
          disabled={!trainerUsable(option)}
          onSelect={() => onSelect(option)}
          title={option.trainerName}
          subtitle={option.providerName}
          price={`≈ ${formatUsd(option.estimate.usd)}`}
          priceDetail={
            option.estimate.low !== null && option.estimate.high !== null
              ? `${formatUsd(option.estimate.low)}–${formatUsd(option.estimate.high)}`
              : undefined
          }
          badges={
            <>
              {!option.connected && <Badge variant="outline">Not connected</Badge>}
              {!option.supported && <Badge variant="outline">Unsupported</Badge>}
            </>
          }
          meta={[
            option.output === "hub" ? "Weights to your Hub" : "Weights stay with the provider",
            option.estimate.basis,
          ]}
          reasons={option.reasons}
        />
      ))}
    </div>
  );
}

export function deploymentOptionKey(option: DeploymentOption): string {
  return `${option.provider}:${option.host}:${option.hardware?.id ?? "-"}:${option.region?.id ?? "-"}`;
}

function deploymentUsable(option: DeploymentOption): boolean {
  return option.fits && option.connected && option.verdict.effect !== "block";
}

function deploymentPrice(option: DeploymentOption): { price: string; detail?: string } {
  if (option.hourlyUsd !== null) {
    return {
      price: `${formatUsd(option.hourlyUsd)}/h`,
      detail: `≈ ${formatUsd(option.hourlyUsd * 730)}/month always on`,
    };
  }

  return option.perMillionTokensUsd !== null
    ? { price: formatUsd(option.perMillionTokensUsd), detail: "per million tokens" }
    : { price: "Provider pricing" };
}

export function DeploymentOptionPicker({
  options,
  selectedKey,
  onSelect,
}: {
  options: readonly DeploymentOption[];
  selectedKey: string | null;
  onSelect: (option: DeploymentOption) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No host in the catalogue can serve this version.
      </p>
    );
  }

  return (
    <div role="radiogroup" aria-label="Host" className="space-y-2">
      {rank(options, deploymentUsable).map((option) => {
        const { price, detail } = deploymentPrice(option);

        return (
          <OptionRow
            key={deploymentOptionKey(option)}
            group="host"
            selected={selectedKey === deploymentOptionKey(option)}
            disabled={!deploymentUsable(option)}
            onSelect={() => onSelect(option)}
            title={option.hostName}
            subtitle={[option.providerName, option.hardware?.label].filter(Boolean).join(" · ")}
            price={price}
            priceDetail={detail}
            badges={
              <>
                <VerdictBadge effect={option.verdict.effect} />
                {!option.connected && <Badge variant="outline">Not connected</Badge>}
                {!option.fits && <Badge variant="outline">Does not fit</Badge>}
              </>
            }
            meta={[
              DEPLOYMENT_SHAPE_LABELS[option.shape],
              option.region
                ? `${option.region.label} (${option.region.jurisdiction.toUpperCase()})`
                : "Any region",
              option.scaleToZero ? "Sleeps when idle" : "Always on",
              option.weightsVerified ? "Your exact weights" : "Catalogue weights",
              `Retention: ${option.retention}`,
            ]}
            reasons={option.reasons}
          />
        );
      })}
    </div>
  );
}
