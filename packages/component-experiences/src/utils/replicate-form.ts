import type { ReplicateModel } from "@ngriffin_uk/polychat-schemas";
import { splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";

export function splitInputLines(value: string): string[] {
  return value.split("\n");
}

export function buildInitialFormData(model: ReplicateModel): Record<string, unknown> {
  return Object.fromEntries(
    model.inputSchema.fields
      .filter((field) => field.default !== undefined)
      .map((field) => [field.name, field.default]),
  );
}

export function normaliseReplicateFormData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([name, value]) => [
      name,
      Array.isArray(value) && value.every((item) => typeof item === "string")
        ? splitNonEmptyLines(value.join("\n"))
        : value,
    ]),
  );
}

export function isReplicateRequiredValueMissing(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (typeof value === "number") {
    return !Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}
