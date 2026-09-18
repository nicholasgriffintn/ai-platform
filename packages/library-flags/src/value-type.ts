import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { FlagValue } from "./types.js";

export type FlagValueType = "boolean" | "string" | "number" | "object";

export function flagValueType(value: FlagValue): FlagValueType {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "number":
      return "number";
    default:
      return "object";
  }
}

export function isFlagValue(value: unknown): value is FlagValue {
  return (
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    isRecord(value)
  );
}

export function matchesValueType<T extends FlagValue>(value: unknown, reference: T): value is T {
  return isFlagValue(value) && flagValueType(value) === flagValueType(reference);
}
