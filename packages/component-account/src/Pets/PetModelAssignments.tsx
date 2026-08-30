import { Button, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { PetModelOverrides, PetSelection } from "@ngriffin_uk/polychat-schemas";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { PetSettingsOption } from "./PetSettings";

export interface PetModelTargetOption {
  kind: "family" | "provider";
  value: string;
  label: string;
}

export interface PetModelAssignmentsProps {
  targets: PetModelTargetOption[];
  pets: PetSettingsOption[];
  overrides: PetModelOverrides;
  disabled?: boolean;
  onChange: (overrides: PetModelOverrides) => void;
}

function targetKey(target: Pick<PetModelTargetOption, "kind" | "value">): string {
  return `${target.kind}:${target.value}`;
}

function petKey(pet: Pick<PetSettingsOption, "source" | "id">): string {
  return `${pet.source}:${pet.id}`;
}

function withOverride(
  overrides: PetModelOverrides,
  target: PetModelTargetOption,
  selection: PetSelection | undefined,
): PetModelOverrides {
  const group = target.kind === "family" ? "families" : "providers";
  const nextGroup = { ...overrides[group] };

  if (selection) {
    nextGroup[target.value] = selection;
  } else {
    delete nextGroup[target.value];
  }

  return { ...overrides, [group]: nextGroup };
}

export function PetModelAssignments({
  targets,
  pets,
  overrides,
  disabled = false,
  onChange,
}: PetModelAssignmentsProps) {
  const [selectedTargetKey, setSelectedTargetKey] = useState("");
  const [selectedPetKey, setSelectedPetKey] = useState("");

  const configuredKeys = useMemo(
    () =>
      new Set([
        ...Object.keys(overrides.families).map((value) => `family:${value}`),
        ...Object.keys(overrides.providers).map((value) => `provider:${value}`),
      ]),
    [overrides],
  );
  const targetsByKey = new Map(targets.map((target) => [targetKey(target), target]));
  const availableTargets = targets.filter((target) => !configuredKeys.has(targetKey(target)));
  const assignments = [...configuredKeys].map((key) => {
    const configured = targetsByKey.get(key);

    if (configured) {
      return configured;
    }

    const separator = key.indexOf(":");
    const kind = key.slice(0, separator) as PetModelTargetOption["kind"];
    const value = key.slice(separator + 1);

    return { kind, value, label: value };
  });

  // ES2022 lacks toSorted; assignments is a new array and is safe to order in place.
  assignments.sort((left, right) => left.label.localeCompare(right.label));
  const petOptions = pets.map((pet) => ({ value: petKey(pet), label: pet.name }));

  useEffect(() => {
    if (selectedPetKey && !pets.some((pet) => petKey(pet) === selectedPetKey)) {
      setSelectedPetKey("");
    }
  }, [pets, selectedPetKey]);

  const addAssignment = () => {
    const target = availableTargets.find((option) => targetKey(option) === selectedTargetKey);
    const pet = pets.find((option) => petKey(option) === selectedPetKey);

    if (!target || !pet) {
      return;
    }

    onChange(
      withOverride(overrides, target, {
        pet_source: pet.source,
        pet_id: pet.id,
      }),
    );
    setSelectedTargetKey("");
    setSelectedPetKey("");
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Model companions</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Give a provider or model family its own pet. A family choice wins when both match;
          everything else uses your default pet.
        </p>
      </div>

      {assignments.length > 0 ? (
        <ul className="space-y-2">
          {assignments.map((target) => {
            const group = target.kind === "family" ? overrides.families : overrides.providers;
            const selection = group[target.value];
            const value = selection
              ? petKey({ source: selection.pet_source, id: selection.pet_id })
              : "";
            const assignmentPetOptions = petOptions.some((option) => option.value === value)
              ? petOptions
              : [{ value, label: "Assigned custom pet" }, ...petOptions];

            return (
              <li
                key={targetKey(target)}
                className="grid gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
              >
                <div>
                  <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                    {target.kind === "family" ? "Model family" : "Provider"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {target.label}
                  </p>
                </div>
                <FormSelect
                  label="Pet"
                  aria-label={`Pet for ${target.label}`}
                  value={value}
                  options={assignmentPetOptions}
                  disabled={disabled}
                  onChange={(event) => {
                    const pet = pets.find((option) => petKey(option) === event.target.value);

                    if (pet) {
                      onChange(
                        withOverride(overrides, target, {
                          pet_source: pet.source,
                          pet_id: pet.id,
                        }),
                      );
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Use default pet for ${target.label}`}
                  title="Use default pet"
                  disabled={disabled}
                  onClick={() => onChange(withOverride(overrides, target, undefined))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No model-specific pets yet.
        </p>
      )}

      {availableTargets.length > 0 ? (
        <div className="grid gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <FormSelect
            label="Provider or family"
            value={selectedTargetKey}
            disabled={disabled}
            options={[
              { value: "", label: "Choose one" },
              ...availableTargets.map((target) => ({
                value: targetKey(target),
                label: `${target.label} · ${target.kind === "family" ? "family" : "provider"}`,
              })),
            ]}
            onChange={(event) => setSelectedTargetKey(event.target.value)}
          />
          <FormSelect
            label="Pet"
            value={selectedPetKey}
            disabled={disabled}
            options={[{ value: "", label: "Choose a pet" }, ...petOptions]}
            onChange={(event) => setSelectedPetKey(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !selectedTargetKey || !selectedPetKey}
            onClick={addAssignment}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Custom pet choices come from the library page shown above.
      </p>
    </section>
  );
}
