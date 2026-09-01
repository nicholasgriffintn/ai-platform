import type { CreditState, UsageSource } from "@ngriffin_uk/polychat-schemas";
import { formatUsdFromMicros } from "@ngriffin_uk/polychat-utility-core";

export const USAGE_SOURCE_LABELS: Record<UsageSource, string> = {
  model: "Models",
  hosted_tool: "Hosted tools",
  capability: "Capabilities",
  infrastructure: "Infrastructure",
};

export const CREDIT_STATE_LABELS: Record<CreditState, string> = {
  ok: "On track",
  reserve: "In reserve",
  overage: "In overage",
  exhausted: "Out of credits",
};

export const CREDIT_STATE_DESCRIPTIONS: Record<CreditState, string> = {
  ok: "Plenty of runway left this period.",
  reserve: "You are into your reserve. Everything keeps working while it lasts.",
  overage: "Past your included credits. Extra usage is billed as overage.",
  exhausted: "New turns pause until the period resets or overage is switched on.",
};

export function humaniseUsageSource(source: string): string {
  return USAGE_SOURCE_LABELS[source as UsageSource] ?? humaniseIdentifier(source);
}

export function humaniseIdentifier(value: string): string {
  if (!value || value === "*") {
    return "General";
  }

  const spaced = value.replaceAll(/[_-]/g, " ").trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function humaniseUsageUnit(unit: string): string {
  if (unit === "usd_micros") {
    return "direct cost";
  }

  return unit.replaceAll("_", " ");
}

export function formatUsageQuantity(quantity: number, unit: string): string {
  if (unit === "usd_micros") {
    return formatUsdFromMicros(quantity);
  }

  const formatted = Number.isInteger(quantity)
    ? quantity.toLocaleString("en-GB")
    : quantity.toLocaleString("en-GB", { maximumFractionDigits: 2 });

  return `${formatted} ${humaniseUsageUnit(unit)}`;
}

export function describeUsageEvent(vendor: string, resource: string): string {
  const vendorLabel = humaniseIdentifier(vendor);

  if (!resource || resource === "*") {
    return vendorLabel;
  }

  return `${vendorLabel} · ${resource}`;
}
