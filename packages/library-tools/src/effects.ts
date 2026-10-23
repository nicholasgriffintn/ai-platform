import {
  UNDECLARED_TOOL_EFFECT_CLASS,
  toolEffectClassSchema,
  type ToolEffectClass,
} from "@ngriffin_uk/polychat-schemas";

import { ToolError } from "./errors.js";

export interface ToolEffectHints {
  readOnly?: boolean;
  destructive?: boolean;
}

export interface ToolEffects<TInput = unknown, THost = unknown> {
  effectClass: ToolEffectClass | ((input: TInput) => ToolEffectClass);
  destination?: (input: TInput) => string | undefined;
  hints?(
    input: TInput,
    host: THost,
  ): ToolEffectHints | undefined | Promise<ToolEffectHints | undefined>;
}

export function effectClassFromToolHints(hints: ToolEffectHints): ToolEffectClass {
  if (hints.readOnly) {
    return "read";
  }

  return hints.destructive ? "destructive" : "write";
}

export function toolHintsFromEffectClass(effectClass: ToolEffectClass): ToolEffectHints {
  return { readOnly: effectClass === "read", destructive: effectClass === "destructive" };
}

export function resolveToolEffectClass<TInput>(
  effects: ToolEffects<TInput, never> | ToolEffects<TInput> | undefined,
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

export async function resolveToolEffectClassWithHints<TInput, THost>(
  effects: ToolEffects<TInput, THost> | undefined,
  input: TInput,
  host: THost,
): Promise<ToolEffectClass> {
  if (!effects?.hints) {
    return resolveToolEffectClass(effects, input);
  }

  try {
    const hints = await effects.hints(input, host);

    return hints ? effectClassFromToolHints(hints) : resolveToolEffectClass(effects, input);
  } catch {
    return resolveToolEffectClass(effects, input);
  }
}

export function resolveToolDestination<TInput>(
  effects: ToolEffects<TInput, never> | ToolEffects<TInput> | undefined,
  input: TInput,
): string | undefined {
  try {
    const destination = effects?.destination?.(input)?.trim();

    return destination ? destination : undefined;
  } catch {
    return undefined;
  }
}

export function requireToolEffects<TInput, THost>(
  name: string,
  effects: ToolEffects<TInput, THost> | undefined,
): ToolEffects<TInput, THost> {
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
