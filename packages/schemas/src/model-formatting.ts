import type { ModelDataRetention, ModelZeroRetention } from "./models.js";

export function formatTokenCount(value?: number) {
  if (!value) {
    return null;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }

  return String(value);
}

export function formatTokenPrice(value?: number) {
  if (typeof value !== "number") {
    return null;
  }

  if (value === 0) {
    return "$0 / 1K tokens";
  }

  if (value < 0.01) {
    return `$${value.toFixed(4)} / 1K tokens`;
  }

  return `$${value.toFixed(2)} / 1K tokens`;
}

const ZERO_RETENTION_NOTES: Record<ModelZeroRetention, string> = {
  default: "Nothing is kept by default.",
  account_setting: "Zero retention depends on how the provider account is configured.",
  on_request: "Zero retention is available by agreement with the provider.",
};

export function describeModelDataRetention(retention: ModelDataRetention): string {
  const kept =
    retention.maxDays === undefined
      ? "The provider sets how long prompts and replies are kept."
      : retention.maxDays === 0
        ? "The provider does not keep prompts or replies."
        : `The provider may keep prompts and replies for up to ${retention.maxDays} days for abuse monitoring.`;
  const zero = retention.zeroRetention ? ZERO_RETENTION_NOTES[retention.zeroRetention] : null;

  return zero ? `${kept} ${zero}` : kept;
}
