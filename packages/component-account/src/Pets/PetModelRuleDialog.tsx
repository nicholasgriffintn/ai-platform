import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SearchInput,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  PET_MODEL_TARGET_GROUPS,
  petKey,
  petModelTargetKey,
  type PetModelTargetOption,
} from "./petModelTargets";
import type { PetSettingsOption } from "./PetSettings";

export interface PetModelRuleDialogProps {
  open: boolean;
  targets: PetModelTargetOption[];
  pets: PetSettingsOption[];
  defaultPetKey?: string;
  renderPreview?: (option: PetSettingsOption, size?: number) => ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (target: PetModelTargetOption, pet: PetSettingsOption) => void;
}

function matchesQuery(target: PetModelTargetOption, query: string): boolean {
  return target.label.toLowerCase().includes(query) || target.value.toLowerCase().includes(query);
}

export function PetModelRuleDialog({
  open,
  targets,
  pets,
  defaultPetKey,
  renderPreview,
  onOpenChange,
  onSubmit,
}: PetModelRuleDialogProps) {
  const [query, setQuery] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [selectedPetKey, setSelectedPetKey] = useState(defaultPetKey ?? "");

  useEffect(() => {
    if (open) {
      setQuery("");
      setTargetKey("");
      setSelectedPetKey(defaultPetKey ?? "");
    }
  }, [open, defaultPetKey]);

  const groups = useMemo(() => {
    const normalised = query.trim().toLowerCase();

    return PET_MODEL_TARGET_GROUPS.map((group) => {
      const options = targets.filter(
        (target) => target.kind === group.kind && (!normalised || matchesQuery(target, normalised)),
      );

      return { kind: group.kind, title: group.title, hint: group.hint, options };
    }).filter((group) => group.options.length > 0);
  }, [query, targets]);

  const target = targets.find((option) => petModelTargetKey(option) === targetKey);
  const pet = pets.find((option) => petKey(option) === selectedPetKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="52rem">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a companion rule</DialogTitle>
          <DialogDescription>
            Pick what the rule covers, then the pet that should show up for it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search makers, providers, families"
              aria-label="Search model targets"
            />
            <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {groups.length === 0 ? (
                <p className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Nothing matches that search.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.kind} className="space-y-1">
                    <p className="px-2 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                      {group.title}
                    </p>
                    <p className="px-2 text-xs text-zinc-500 dark:text-zinc-400">{group.hint}</p>
                    <ul>
                      {group.options.map((option) => {
                        const key = petModelTargetKey(option);
                        const isSelected = key === targetKey;

                        return (
                          <li key={key}>
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => setTargetKey(key)}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                                isSelected
                                  ? "bg-zinc-100 dark:bg-zinc-800"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                              }`}
                            >
                              <ModelIcon
                                modelName={option.iconModelName ?? option.label}
                                provider={option.iconProvider}
                                size={18}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-100">
                                {option.label}
                              </span>
                              {option.modelCount ? (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {option.modelCount}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p
              id="pet_rule_pet_label"
              className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
            >
              Pet
            </p>
            <ul
              aria-labelledby="pet_rule_pet_label"
              className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-zinc-200 p-2 sm:grid-cols-3 dark:border-zinc-700"
            >
              {pets.map((option) => {
                const key = petKey(option);
                const isSelected = key === selectedPetKey;

                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedPetKey(key)}
                      className={`flex h-full w-full flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors ${
                        isSelected
                          ? "border-zinc-800 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-800"
                          : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      {renderPreview ? (
                        <span className="flex h-12 items-end justify-center">
                          {renderPreview(option, 48)}
                        </span>
                      ) : null}
                      <span className="truncate text-xs text-zinc-800 dark:text-zinc-100">
                        {option.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!target || !pet}
            onClick={() => {
              if (target && pet) {
                onSubmit(target, pet);
              }
            }}
          >
            Add rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
