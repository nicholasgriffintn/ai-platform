import type { PetModelOverrides, PetSelection, PetSource } from "@ngriffin_uk/polychat-schemas";

export type PetModelTargetKind = "maker" | "provider" | "family";

export interface PetModelTargetOption {
  kind: PetModelTargetKind;
  value: string;
  label: string;
  modelCount?: number;
  iconModelName?: string;
  iconProvider?: string;
}

const TARGET_GROUPS: Record<PetModelTargetKind, keyof PetModelOverrides> = {
  family: "families",
  provider: "providers",
  maker: "makers",
};

const TARGET_KIND_ORDER: PetModelTargetKind[] = ["maker", "provider", "family"];

export const PET_MODEL_TARGET_GROUPS: Array<{
  kind: PetModelTargetKind;
  title: string;
  hint: string;
}> = [
  { kind: "maker", title: "Makers", hint: "Every model they make, whoever serves it" },
  { kind: "provider", title: "Providers", hint: "Everything served by one provider" },
  { kind: "family", title: "Model families", hint: "One family, nothing else" },
];

export function petModelTargetKey(target: Pick<PetModelTargetOption, "kind" | "value">): string {
  return `${target.kind}:${target.value}`;
}

export function petKey(pet: { source: PetSource; id: string }): string {
  return `${pet.source}:${pet.id}`;
}

const TARGET_KIND_DESCRIPTIONS: Record<PetModelTargetKind, (label: string) => string> = {
  maker: (label) => `Every ${label} model, whoever serves it`,
  provider: (label) => `Anything served by ${label}`,
  family: (label) => `The ${label} family only`,
};

export function describePetModelTarget(target: PetModelTargetOption): string {
  return TARGET_KIND_DESCRIPTIONS[target.kind](target.label);
}

export function withPetModelOverride(
  overrides: PetModelOverrides,
  target: Pick<PetModelTargetOption, "kind" | "value">,
  selection: PetSelection | undefined,
): PetModelOverrides {
  const group = TARGET_GROUPS[target.kind];
  const nextGroup = { ...overrides[group] };

  if (selection) {
    nextGroup[target.value] = selection;
  } else {
    delete nextGroup[target.value];
  }

  return { ...overrides, [group]: nextGroup };
}

export function petModelSelectionFor(
  overrides: PetModelOverrides,
  target: Pick<PetModelTargetOption, "kind" | "value">,
): PetSelection | undefined {
  return overrides[TARGET_GROUPS[target.kind]][target.value];
}

export function listPetModelAssignments(
  overrides: PetModelOverrides,
  targets: PetModelTargetOption[],
): PetModelTargetOption[] {
  const known = new Map(targets.map((target) => [petModelTargetKey(target), target]));
  const configured = TARGET_KIND_ORDER.flatMap((kind) =>
    Object.keys(overrides[TARGET_GROUPS[kind]]).map(
      (value) =>
        known.get(petModelTargetKey({ kind, value })) ?? {
          kind,
          value,
          label: value,
          modelCount: 0,
        },
    ),
  );

  // oxlint-disable-next-line unicorn/no-array-sort
  return configured.sort(
    (left, right) =>
      TARGET_KIND_ORDER.indexOf(left.kind) - TARGET_KIND_ORDER.indexOf(right.kind) ||
      left.label.localeCompare(right.label),
  );
}
