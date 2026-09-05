import { Button, Switch, TextLink } from "@ngriffin_uk/polychat-component-ui";
import type { PetModelOverrides, PetSheetLayout, PetSource } from "@ngriffin_uk/polychat-schemas";
import { ArrowRight, Sparkles, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";

import { SettingsSection } from "../SettingsSection";
import { PetModelAssignments } from "./PetModelAssignments";
import { petKey, type PetModelTargetOption } from "./petModelTargets";

export interface PetSettingsOption {
  id: string;
  source: PetSource;
  name: string;
  description?: string | null;
  canDelete: boolean;
  layout?: PetSheetLayout;
  sheetUrl?: string;
}

export interface PetSettingsProps {
  options: PetSettingsOption[];
  selectedId: string;
  travelEnabled: boolean;
  animationEnabled: boolean;
  canAuthor: boolean;
  modelTargets: PetModelTargetOption[];
  modelOverrides: PetModelOverrides;
  customPetPage: number;
  hasPreviousCustomPets: boolean;
  hasNextCustomPets: boolean;
  isBusy?: boolean;
  error?: string | null;
  renderPreview: (option: PetSettingsOption, size?: number) => ReactNode;
  onSelect: (option: PetSettingsOption) => void;
  onTravelChange: (enabled: boolean) => void;
  onAnimationChange: (enabled: boolean) => void;
  onModelOverridesChange: (overrides: PetModelOverrides) => void;
  onPreviousCustomPets: () => void;
  onNextCustomPets: () => void;
  onDelete: (option: PetSettingsOption) => void;
  onUpload: () => void;
  onGenerate: () => void;
}

export function PetSettings({
  options,
  selectedId,
  travelEnabled,
  animationEnabled,
  canAuthor,
  modelTargets,
  modelOverrides,
  customPetPage,
  hasPreviousCustomPets,
  hasNextCustomPets,
  isBusy = false,
  error = null,
  renderPreview,
  onSelect,
  onTravelChange,
  onAnimationChange,
  onModelOverridesChange,
  onPreviousCustomPets,
  onNextCustomPets,
  onDelete,
  onUpload,
  onGenerate,
}: PetSettingsProps) {
  const selectedOption = options.find((option) => option.id === selectedId);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Choose your pet"
        description="Polys are the house birds. The rest are strays we let in. Bring your own if you would rather."
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || !canAuthor}
              onClick={onUpload}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload a pet
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || !canAuthor}
              onClick={onGenerate}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Create with Polychat
            </Button>
          </div>
        }
      >
        {canAuthor ? null : (
          <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
            Uploading a sprite sheet, or having Polychat draw one, needs a Pro plan.
          </p>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {options.map((option) => {
            const isSelected = option.id === selectedId;

            return (
              <li key={`${option.source}:${option.id}`} className="relative">
                <button
                  type="button"
                  onClick={() => onSelect(option)}
                  disabled={isBusy}
                  aria-pressed={isSelected}
                  className={`flex h-full w-full flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors disabled:opacity-60 ${
                    isSelected
                      ? "border-active-work/50 bg-selection"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <span className="flex h-20 items-end justify-center">
                    {renderPreview(option)}
                  </span>
                  <span className="text-sm font-medium text-foreground">{option.name}</span>
                  {option.description ? (
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  ) : null}
                </button>
                {option.canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1"
                    aria-label={`Delete ${option.name}`}
                    disabled={isBusy}
                    onClick={() => onDelete(option)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {hasPreviousCustomPets || hasNextCustomPets ? (
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy || !hasPreviousCustomPets}
              onClick={onPreviousCustomPets}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Custom pets, page {customPetPage}</span>
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy || !hasNextCustomPets}
              onClick={onNextCustomPets}
            >
              Next
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-failure">{error}</p> : null}

        <div className="flex justify-end">
          <TextLink href="/pets" size="xs" trailingIcon={<ArrowRight size={13} />}>
            Meet the pets
          </TextLink>
        </div>
      </SettingsSection>

      <PetModelAssignments
        targets={modelTargets}
        pets={options}
        overrides={modelOverrides}
        defaultPetKey={selectedOption ? petKey(selectedOption) : undefined}
        disabled={isBusy}
        renderPreview={renderPreview}
        onChange={onModelOverridesChange}
      />

      <SettingsSection title="Movement">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
          <div>
            <label
              htmlFor="pet_animation_enabled"
              className="block text-sm font-medium text-foreground"
            >
              Animate your pet
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Off by default, your pet stays in its neutral pose. Your reduced-motion preference
              always takes priority.
            </p>
          </div>
          <Switch
            id="pet_animation_enabled"
            checked={animationEnabled}
            disabled={isBusy}
            onChange={(event) => onAnimationChange(event.target.checked)}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Following you around">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
          <div>
            <label
              htmlFor="pet_travel_enabled"
              className="block text-sm font-medium text-foreground"
            >
              Let your pet follow you
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              It comes with you into conversations and perches above the composer. Off, it stays on
              the new chat screen.
            </p>
          </div>
          <Switch
            id="pet_travel_enabled"
            checked={travelEnabled}
            disabled={isBusy}
            onChange={(event) => onTravelChange(event.target.checked)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
