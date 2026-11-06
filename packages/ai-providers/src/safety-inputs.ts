import type { InputSchemaInputFieldDescriptor } from "@ngriffin_uk/polychat-schemas";

const PINNED_SAFETY_INPUTS: Readonly<Record<string, unknown>> = {
  content_moderation: true,
  disable_safety_checker: false,
  disable_safety_filter: false,
  moderation: "auto",
  safety_tolerance: 2,
};

export function isPinnedSafetyInput(field: InputSchemaInputFieldDescriptor): boolean {
  return resolvePinnedSafetyInput(field) !== undefined;
}

export function resolvePinnedSafetyInput(field: InputSchemaInputFieldDescriptor): unknown {
  if (field.name === "safety_filter_level") {
    return field.enum?.find((level) => typeof level === "string" && level.includes("medium"));
  }

  return PINNED_SAFETY_INPUTS[field.name];
}
