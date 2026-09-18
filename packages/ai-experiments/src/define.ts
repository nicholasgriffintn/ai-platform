import type { EvaluationContext, FlagRule, FlagValue } from "@ngriffin_uk/polychat-library-flags";

export interface FlagDefinition<T extends FlagValue = FlagValue> {
  kind: "flag";
  key: string;
  description?: string;
  defaultValue: T;
  variants: Record<string, T>;
  defaultVariant: string;
  enabled?: (context: EvaluationContext) => boolean;
  target?: (context: EvaluationContext) => string | undefined;
}

export interface DefineFlagInput<T extends FlagValue> {
  key: string;
  description?: string;
  defaultValue: T;
  variants?: Record<string, T>;
  enabled?: (context: EvaluationContext) => boolean;
  target?: (context: EvaluationContext) => string | undefined;
}

export type VariantName<TVariants> = Extract<keyof TVariants, string>;

export interface ExperimentDefinition<TVariants extends Record<string, unknown>> {
  kind: "experiment";
  key: string;
  description?: string;
  variants: TVariants;
  control: VariantName<TVariants>;
  weights: Record<string, number>;
  enabled?: (context: EvaluationContext) => boolean;
  target?: (context: EvaluationContext) => VariantName<TVariants> | undefined;
}

export interface DefineExperimentInput<TVariants extends Record<string, unknown>> {
  key: string;
  description?: string;
  variants: TVariants;
  control: VariantName<TVariants>;
  weights?: Partial<Record<VariantName<TVariants>, number>>;
  enabled?: (context: EvaluationContext) => boolean;
  target?: (context: EvaluationContext) => VariantName<TVariants> | undefined;
}

export type AnyExperimentDefinition = ExperimentDefinition<Record<string, unknown>>;
export type AnyDefinition = FlagDefinition | AnyExperimentDefinition;

const KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,99}$/;

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(
      `Flag key "${key}" must be lowercase letters, digits, dots, dashes or underscores`,
    );
  }
}

export function defineFlag<T extends FlagValue>(input: DefineFlagInput<T>): FlagDefinition<T> {
  assertKey(input.key);

  const variants = input.variants ?? { on: input.defaultValue };
  const defaultVariant = Object.entries(variants).find(
    ([, value]) => value === input.defaultValue,
  )?.[0];

  if (!defaultVariant) {
    throw new Error(`Flag "${input.key}" needs a variant whose value is the default`);
  }

  return {
    kind: "flag",
    key: input.key,
    description: input.description,
    defaultValue: input.defaultValue,
    variants,
    defaultVariant,
    enabled: input.enabled,
    target: input.target,
  };
}

export function defineExperiment<TVariants extends Record<string, unknown>>(
  input: DefineExperimentInput<TVariants>,
): ExperimentDefinition<TVariants> {
  assertKey(input.key);

  const names = Object.keys(input.variants);

  if (names.length < 2) {
    throw new Error(`Experiment "${input.key}" needs at least two variants`);
  }

  if (!names.includes(input.control)) {
    throw new Error(`Experiment "${input.key}" control "${input.control}" is not a variant`);
  }

  const configured = new Map(Object.entries(input.weights ?? {}));
  const weights: Record<string, number> = Object.fromEntries(
    names.map((name) => [name, configured.get(name) ?? 1]),
  );

  return {
    kind: "experiment",
    key: input.key,
    description: input.description,
    variants: input.variants,
    control: input.control,
    weights,
    enabled: input.enabled,
    target: input.target,
  };
}

export function toFlagRule(definition: AnyDefinition): FlagRule {
  if (definition.kind === "flag") {
    return {
      key: definition.key,
      variants: definition.variants,
      defaultVariant: definition.defaultVariant,
      enabled: definition.enabled,
      target: definition.target,
    };
  }

  const names = Object.keys(definition.variants);

  return {
    key: definition.key,
    variants: Object.fromEntries(names.map((name) => [name, name])),
    defaultVariant: definition.control,
    split: definition.weights,
    enabled: definition.enabled,
    target: definition.target,
  };
}

export function createDefinitionRegistry(definitions: readonly AnyDefinition[]) {
  const byKey = new Map<string, AnyDefinition>();

  for (const definition of definitions) {
    if (byKey.has(definition.key)) {
      throw new Error(`Flag "${definition.key}" is defined twice`);
    }

    byKey.set(definition.key, definition);
  }

  return {
    list: () => [...byKey.values()],
    find: (key: string) => byKey.get(key),
    rule: (key: string) => {
      const definition = byKey.get(key);

      return definition ? toFlagRule(definition) : undefined;
    },
  };
}

export type DefinitionRegistry = ReturnType<typeof createDefinitionRegistry>;
