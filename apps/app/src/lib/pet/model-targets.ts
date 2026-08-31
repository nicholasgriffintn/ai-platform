import type { PetModelTargetOption } from "@ngriffin_uk/polychat-component-account";
import {
  findModelMaker,
  formatModelFamilyLabel,
  formatProviderLabel,
  resolveModelMakerId,
  type ModelConfig,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";

const KIND_ORDER: Record<PetModelTargetOption["kind"], number> = {
  maker: 0,
  provider: 1,
  family: 2,
};

type CountedTarget = PetModelTargetOption & { modelCount: number };

function countTarget(
  targets: Map<string, CountedTarget>,
  option: Omit<PetModelTargetOption, "modelCount">,
) {
  const existing = targets.get(option.value);

  if (existing) {
    existing.modelCount += 1;

    return;
  }

  targets.set(option.value, { ...option, modelCount: 1 });
}

function modelIconName(model: ModelConfigItem): string {
  return model.name ?? model.matchingModel ?? "";
}

export function getPetModelTargetOptions(models: ModelConfig): PetModelTargetOption[] {
  const makers = new Map<string, CountedTarget>();
  const providers = new Map<string, CountedTarget>();
  const families = new Map<string, CountedTarget>();

  for (const model of Object.values(models)) {
    const provider = model.provider?.trim().toLowerCase();
    const family = model.family?.trim().toLowerCase();
    const makerId = resolveModelMakerId(model);

    if (makerId) {
      countTarget(makers, {
        kind: "maker",
        value: makerId,
        label: findModelMaker(makerId)?.label ?? makerId,
        iconModelName: modelIconName(model),
        iconProvider: provider,
      });
    }

    if (provider) {
      countTarget(providers, {
        kind: "provider",
        value: provider,
        label: formatProviderLabel(provider),
        iconModelName: formatProviderLabel(provider),
        iconProvider: provider,
      });
    }

    if (family) {
      countTarget(families, {
        kind: "family",
        value: family,
        label: formatModelFamilyLabel(family),
        iconModelName: modelIconName(model),
        iconProvider: provider,
      });
    }
  }

  const options = [...makers.values(), ...providers.values(), ...families.values()];

  // oxlint-disable-next-line unicorn/no-array-sort
  return options.sort(
    (left, right) =>
      KIND_ORDER[left.kind] - KIND_ORDER[right.kind] || left.label.localeCompare(right.label),
  );
}
