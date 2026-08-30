import type { PetModelTargetOption } from "@ngriffin_uk/polychat-component-account";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

function collectTargets(
  values: Array<string | undefined>,
  kind: PetModelTargetOption["kind"],
): PetModelTargetOption[] {
  const targets = new Map<string, string>();

  for (const rawValue of values) {
    const value = rawValue?.trim();

    if (!value) {
      continue;
    }

    const normalised = value.toLowerCase();

    if (!targets.has(normalised)) {
      targets.set(normalised, value);
    }
  }

  const options = [...targets.entries()].map(([value, label]) => ({ kind, value, label }));

  // ES2022 lacks toSorted; options is a new array and is safe to order in place.
  // oxlint-disable-next-line unicorn/no-array-sort
  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export function getPetModelTargetOptions(models: ModelConfig): PetModelTargetOption[] {
  const entries = Object.values(models);

  return [
    ...collectTargets(
      entries.map((model) => model.provider),
      "provider",
    ),
    ...collectTargets(
      entries.map((model) => model.family),
      "family",
    ),
  ];
}
