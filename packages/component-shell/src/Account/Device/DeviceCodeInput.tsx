import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  DEVICE_USER_CODE_LENGTH,
  readDeviceUserCodeCharacters,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

const GROUP_SIZE = DEVICE_USER_CODE_LENGTH / 2;
const CELL_POSITIONS = Array.from({ length: DEVICE_USER_CODE_LENGTH }, (_, position) => position);

interface DeviceCodeCellsProps {
  characters: string;
  activeIndex?: number;
  invalid?: boolean;
}

export function DeviceCodeCells({ characters, activeIndex, invalid }: DeviceCodeCellsProps) {
  return (
    <div className="flex w-full items-center justify-center gap-1.5" aria-hidden="true">
      {CELL_POSITIONS.map((index) => (
        <div key={`cell-${index}`} className="contents">
          {index === GROUP_SIZE ? (
            <span className="h-0.5 w-2.5 shrink-0 rounded-full bg-border-strong sm:w-3" />
          ) : null}
          <span
            className={cn(
              "polychat-motion-micro flex aspect-[4/5] max-w-11 min-w-0 flex-1 items-center justify-center rounded-lg border bg-canvas font-mono text-xl font-medium text-foreground transition-colors sm:text-2xl",
              invalid
                ? "border-failure/70"
                : index === activeIndex
                  ? "border-active-work ring-2 ring-active-work/25"
                  : characters[index]
                    ? "border-border-strong"
                    : "border-border",
            )}
          >
            {characters[index] ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

interface DeviceCodeInputProps {
  id: string;
  value: string;
  onChange: (characters: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

export function DeviceCodeInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: DeviceCodeInputProps) {
  const [focused, setFocused] = useState(false);
  const activeIndex = focused ? Math.min(value.length, DEVICE_USER_CODE_LENGTH - 1) : undefined;

  return (
    <div className="relative">
      <DeviceCodeCells characters={value} activeIndex={activeIndex} invalid={invalid} />
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(readDeviceUserCodeCharacters(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  );
}
