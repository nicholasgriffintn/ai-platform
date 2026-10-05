import {
  UNDECLARED_TOOL_EFFECT_CLASS,
  toolEffectClassSchema,
  type ToolEffectClass,
} from "@ngriffin_uk/polychat-schemas";

import { ToolError } from "./errors.js";

export interface ToolEffects<TInput = unknown> {
  effectClass: ToolEffectClass | ((input: TInput) => ToolEffectClass);
  destination?: (input: TInput) => string | undefined;
}

export function resolveToolEffectClass<TInput>(
  effects: ToolEffects<TInput> | undefined,
  input: TInput,
): ToolEffectClass {
  if (!effects) {
    return UNDECLARED_TOOL_EFFECT_CLASS;
  }

  if (typeof effects.effectClass !== "function") {
    return effects.effectClass;
  }

  try {
    const parsed = toolEffectClassSchema.safeParse(effects.effectClass(input));

    return parsed.success ? parsed.data : UNDECLARED_TOOL_EFFECT_CLASS;
  } catch {
    return UNDECLARED_TOOL_EFFECT_CLASS;
  }
}

export function resolveToolDestination<TInput>(
  effects: ToolEffects<TInput> | undefined,
  input: TInput,
): string | undefined {
  try {
    const destination = effects?.destination?.(input)?.trim();

    return destination ? destination : undefined;
  } catch {
    return undefined;
  }
}

export function requireToolEffects<TInput>(
  name: string,
  effects: ToolEffects<TInput> | undefined,
): ToolEffects<TInput> {
  if (!effects) {
    throw new ToolError("missing_effects", `Tool "${name}" is missing declared effects`, {
      toolName: name,
    });
  }

  if (
    typeof effects.effectClass !== "function" &&
    !toolEffectClassSchema.safeParse(effects.effectClass).success
  ) {
    throw new ToolError("missing_effects", `Tool "${name}" declares an unknown effect class`, {
      toolName: name,
    });
  }

  return effects;
}
