import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import { ALargeSmall, Minus, Plus } from "lucide-react";
import { useId } from "react";

export type NoteFontFamily = "sans" | "serif";
export type NotePaper = "sepia" | "normal";

export const NOTE_FONT_SIZE_MIN = 12;
export const NOTE_FONT_SIZE_MAX = 40;

const FONT_FAMILY_OPTIONS = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
] as const satisfies readonly { value: NoteFontFamily; label: string }[];

const PAPER_OPTIONS = [
  { value: "sepia", label: "Sepia" },
  { value: "normal", label: "Match the app" },
] as const satisfies readonly { value: NotePaper; label: string }[];

function Choice<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: readonly { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-2 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              option.value === value
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function clampSize(size: number): number {
  return Math.min(NOTE_FONT_SIZE_MAX, Math.max(NOTE_FONT_SIZE_MIN, Math.round(size)));
}

export function NoteReadingSettings({
  fontFamily,
  onFontFamilyChange,
  paper,
  onPaperChange,
  fontSize,
  onFontSizeChange,
}: {
  fontFamily: NoteFontFamily;
  onFontFamilyChange: (fontFamily: NoteFontFamily) => void;
  paper: NotePaper;
  onPaperChange: (paper: NotePaper) => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
}) {
  const sizeId = useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="icon"
          size="sm"
          icon={<ALargeSmall size={16} />}
          aria-label="Reading settings"
          title="Reading settings"
        />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="z-[70] w-72 space-y-4">
        <Choice
          label="Typeface"
          value={fontFamily}
          options={FONT_FAMILY_OPTIONS}
          onChange={onFontFamilyChange}
        />
        <Choice label="Paper" value={paper} options={PAPER_OPTIONS} onChange={onPaperChange} />
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={sizeId} className="text-xs font-medium text-muted-foreground">
              Text size
            </label>
            <span className="text-xs text-foreground tabular-nums">{fontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="icon"
              size="sm"
              icon={<Minus size={14} />}
              aria-label="Smaller text"
              disabled={fontSize <= NOTE_FONT_SIZE_MIN}
              onClick={() => onFontSizeChange(clampSize(fontSize - 1))}
            />
            <input
              id={sizeId}
              type="range"
              min={NOTE_FONT_SIZE_MIN}
              max={NOTE_FONT_SIZE_MAX}
              step={1}
              value={fontSize}
              onChange={(event) => onFontSizeChange(clampSize(Number(event.target.value)))}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--polychat-active-work)]"
            />
            <Button
              type="button"
              variant="icon"
              size="sm"
              icon={<Plus size={14} />}
              aria-label="Larger text"
              disabled={fontSize >= NOTE_FONT_SIZE_MAX}
              onClick={() => onFontSizeChange(clampSize(fontSize + 1))}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
