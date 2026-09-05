import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Button, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { PetModelOverrides } from "@ngriffin_uk/polychat-schemas";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { SettingsSection } from "../SettingsSection";
import { PetModelRuleDialog } from "./PetModelRuleDialog";
import {
  describePetModelTarget,
  listPetModelAssignments,
  petKey,
  petModelSelectionFor,
  petModelTargetKey,
  withPetModelOverride,
  type PetModelTargetOption,
} from "./petModelTargets";
import type { PetSettingsOption } from "./PetSettings";

export interface PetModelAssignmentsProps {
  targets: PetModelTargetOption[];
  pets: PetSettingsOption[];
  overrides: PetModelOverrides;
  defaultPetKey?: string;
  disabled?: boolean;
  renderPreview?: (option: PetSettingsOption, size?: number) => ReactNode;
  onChange: (overrides: PetModelOverrides) => void;
}

export function PetModelAssignments({
  targets,
  pets,
  overrides,
  defaultPetKey,
  disabled = false,
  renderPreview,
  onChange,
}: PetModelAssignmentsProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  const assignments = listPetModelAssignments(overrides, targets);
  const configuredKeys = new Set(assignments.map((target) => petModelTargetKey(target)));
  const availableTargets = targets.filter(
    (target) => !configuredKeys.has(petModelTargetKey(target)),
  );
  const petOptions = pets.map((pet) => ({ value: petKey(pet), label: pet.name }));

  return (
    <SettingsSection
      title="Model companions"
      description="Give a maker a pet and every model they make gets it, whoever serves it. Narrow it to a provider or a single family when you want to. Everything else keeps your default pet."
      actions={
        <Button
          type="button"
          variant="outline"
          disabled={disabled || availableTargets.length === 0 || pets.length === 0}
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add a rule
        </Button>
      }
    >
      {assignments.length > 0 ? (
        <>
          <ul className="space-y-2">
            {assignments.map((target) => {
              const selection = petModelSelectionFor(overrides, target);
              const value = selection
                ? petKey({ source: selection.pet_source, id: selection.pet_id })
                : "";
              const assigned = pets.find((option) => petKey(option) === value);
              const selectOptions = assigned
                ? petOptions
                : [{ value, label: "Assigned custom pet" }, ...petOptions];

              return (
                <li
                  key={petModelTargetKey(target)}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                >
                  <ModelIcon
                    modelName={target.iconModelName ?? target.label}
                    provider={target.iconProvider}
                    size={22}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{target.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {describePetModelTarget(target)}
                      {target.modelCount ? ` · ${target.modelCount} models` : ""}
                    </p>
                  </div>
                  {renderPreview && assigned ? (
                    <span className="flex h-10 w-10 items-end justify-center">
                      {renderPreview(assigned, 40)}
                    </span>
                  ) : null}
                  <FormSelect
                    aria-label={`Pet for ${target.label}`}
                    value={value}
                    options={selectOptions}
                    disabled={disabled}
                    fullWidth={false}
                    className="w-40"
                    onChange={(event) => {
                      const pet = pets.find((option) => petKey(option) === event.target.value);

                      if (pet) {
                        onChange(
                          withPetModelOverride(overrides, target, {
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
                    onClick={() => onChange(withPetModelOverride(overrides, target, undefined))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            When rules overlap, the narrowest one wins: family, then provider, then maker.
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border-strong p-4 text-sm text-muted-foreground">
          No rules yet, so every model gets your default pet.
        </p>
      )}

      <PetModelRuleDialog
        open={isAddOpen}
        targets={availableTargets}
        pets={pets}
        defaultPetKey={defaultPetKey}
        renderPreview={renderPreview}
        onOpenChange={setIsAddOpen}
        onSubmit={(target, pet) => {
          onChange(
            withPetModelOverride(overrides, target, {
              pet_source: pet.source,
              pet_id: pet.id,
            }),
          );
          setIsAddOpen(false);
        }}
      />
    </SettingsSection>
  );
}
