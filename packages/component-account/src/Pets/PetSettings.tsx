import { Button, Switch, TextLink } from "@ngriffin_uk/polychat-component-ui";
import type { PetSheetLayout, PetSource } from "@ngriffin_uk/polychat-schemas";
import { ArrowRight, Sparkles, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";

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
  limitReached: boolean;
  libraryLimit: number;
  isBusy?: boolean;
  error?: string | null;
  renderPreview: (option: PetSettingsOption) => ReactNode;
  onSelect: (option: PetSettingsOption) => void;
  onTravelChange: (enabled: boolean) => void;
  onAnimationChange: (enabled: boolean) => void;
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
  limitReached,
  libraryLimit,
  isBusy = false,
  error = null,
  renderPreview,
  onSelect,
  onTravelChange,
  onAnimationChange,
  onDelete,
  onUpload,
  onGenerate,
}: PetSettingsProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Choose your pet</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Polys are the house birds. The rest are strays we let in. Bring your own if you would
              rather.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || !canAuthor || limitReached}
              onClick={onUpload}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload a pet
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || !canAuthor || limitReached}
              onClick={onGenerate}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Create with Polychat
            </Button>
          </div>
        </div>

        {canAuthor ? null : (
          <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Uploading a sprite sheet, or having Polychat draw one, needs a Pro plan.
          </p>
        )}

        {canAuthor && limitReached ? (
          <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            You are keeping the maximum of {libraryLimit} pets. Delete one to add another.
          </p>
        ) : null}

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
                      ? "border-zinc-800 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-800"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                  }`}
                >
                  <span className="flex h-20 items-end justify-center">
                    {renderPreview(option)}
                  </span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {option.name}
                  </span>
                  {option.description ? (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {option.description}
                    </span>
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

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex justify-end">
          <TextLink href="/pets" size="xs" trailingIcon={<ArrowRight size={13} />}>
            Meet the pets
          </TextLink>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Movement</h3>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div>
            <label
              htmlFor="pet_animation_enabled"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Animate your pet
            </label>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Following you around</h3>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div>
            <label
              htmlFor="pet_travel_enabled"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Let your pet follow you
            </label>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
      </section>
    </div>
  );
}
