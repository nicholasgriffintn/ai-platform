export type ParsedNumberInput = number | "";

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export function clampPercentage(value: number): number {
  return clampNumber(value, 0, 100);
}

export function getBoundedPercentage(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return clampPercentage((value / total) * 100);
}

export function formatCredits(credits: number): string {
  if (!Number.isFinite(credits) || credits === 0) {
    return "0";
  }

  const abs = Math.abs(credits);

  if (abs < 0.01) {
    return "< 0.01";
  }

  if (abs >= 1000) {
    return Math.round(credits).toLocaleString("en-GB");
  }

  return credits.toLocaleString("en-GB", {
    maximumFractionDigits: abs >= 10 ? 0 : 2,
  });
}

export function formatUsdFromMicros(usdMicros: number): string {
  if (!Number.isFinite(usdMicros) || usdMicros === 0) {
    return "$0.00";
  }

  const usd = usdMicros / 1_000_000;

  if (Math.abs(usd) < 0.01) {
    return "< $0.01";
  }

  return `$${usd.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseNumberInputValue(
  value: string,
  { integer = false }: { integer?: boolean } = {},
): ParsedNumberInput {
  if (value === "") {
    return "";
  }

  const parsed = integer ? Number.parseInt(value, 10) : Number(value);

  return Number.isFinite(parsed) ? parsed : "";
}

export function getNumberInputValue(value: unknown): ParsedNumberInput {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

export function getFiniteNumberOrFallback(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Number.parseFloat((bytes / k ** i).toFixed(dm)) + sizes[i];
}
