import type { ExtractionAnswer } from "@ngriffin_uk/polychat-schemas";

function formatValue(value: string | number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined) {
    return "none";
  }

  return unit ? `${value} ${unit}` : String(value);
}

function formatProbability(label: string, value: number | null | undefined): string {
  return value === null || value === undefined ? "" : `${label} ${value.toFixed(2)}`;
}

function formatRange(
  low: string | number | null | undefined,
  high: string | number | null | undefined,
) {
  return low === null || low === undefined || high === null || high === undefined
    ? ""
    : `80% range ${low} to ${high}`;
}

function bracket(parts: readonly string[]): string {
  const present = parts.filter(Boolean);

  return present.length > 0 ? ` (${present.join(", ")})` : "";
}

export function formatExtractionAnswer(name: string, answer: ExtractionAnswer): string {
  if (answer.type === "list") {
    const items = answer.value ?? [];

    return `${name}: ${items.length > 0 ? items.join(", ") : "none found"}`;
  }

  if (answer.type === "estimate") {
    return `${name}: ${formatValue(answer.value)}${bracket([
      answer.median === null || answer.median === undefined ? "" : `median ${answer.median}`,
      formatRange(answer.p10, answer.p90),
    ])}`;
  }

  if (answer.type === "forecast") {
    const steps = (answer.value ?? []).map(
      (value, index) =>
        `step ${index + 1} ${formatValue(value)}${bracket([formatRange(answer.p10?.[index], answer.p90?.[index])])}`,
    );

    return `${name}: ${steps.length > 0 ? steps.join("; ") : "none"}`;
  }

  const unit = answer.type === "duration" ? answer.unit : undefined;

  if (answer.value === null) {
    return `${name}: not in the input${bracket([
      formatProbability("p_null", answer.p_null),
      answer.guess === null || answer.guess === undefined
        ? ""
        : `best guess ${formatValue(answer.guess, unit)}`,
    ])}`;
  }

  return `${name}: ${formatValue(answer.value, unit)}${bracket([
    formatProbability("confidence", answer.confidence),
  ])}`;
}
