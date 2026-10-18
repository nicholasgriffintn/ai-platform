import { cn, PetPreview } from "@ngriffin_uk/polychat-component-ui";
import { findPetSheetLayout, PET_PRESETS } from "@ngriffin_uk/polychat-schemas";

export interface TeammateCharacterPickerProps {
  value: string | null;
  disabled: boolean;
  onChange: (characterId: string | null) => void;
}

const OPTION_CLASS =
  "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50";

export function TeammateCharacterPicker({
  value,
  disabled,
  onChange,
}: TeammateCharacterPickerProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">Character</legend>
      <p className="text-xs text-muted-foreground">
        Shows what the teammate is doing wherever it appears: working, waiting on you, or done.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        <button
          type="button"
          aria-pressed={value === null}
          className={cn(
            OPTION_CLASS,
            value === null ? "border-active-work bg-selection" : "border-border hover:bg-muted",
          )}
          onClick={() => onChange(null)}
        >
          <span className="flex h-12 items-center text-muted-foreground">None</span>
          <span>Initial</span>
        </button>
        {PET_PRESETS.map((preset) => (
          <button
            key={preset.slug}
            type="button"
            aria-pressed={value === preset.slug}
            title={preset.description}
            className={cn(
              OPTION_CLASS,
              value === preset.slug
                ? "border-active-work bg-selection"
                : "border-border hover:bg-muted",
            )}
            onClick={() => onChange(preset.slug)}
          >
            <PetPreview
              sheetUrl={preset.sheetUrl}
              layout={findPetSheetLayout(preset.layoutId)}
              label={preset.label}
              size={44}
              paused={value !== preset.slug}
              deferLoading
            />
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
