import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { RealtimeLiveProviderOption } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { Check, Mic, RadioTower, Video } from "lucide-react";

function ProviderIcon({ option }: { option: RealtimeLiveProviderOption }) {
  if (option.inputModalities.includes("video")) {
    return <Video className="h-4 w-4" aria-hidden="true" />;
  }
  if (option.sessionType === "transcription") {
    return <Mic className="h-4 w-4" aria-hidden="true" />;
  }
  return <RadioTower className="h-4 w-4" aria-hidden="true" />;
}

export interface LiveProviderPickerProps {
  options: RealtimeLiveProviderOption[];
  provider: string;
  onProviderChange: (providerId: string) => void;
  isLocked?: boolean;
}

export function LiveProviderPicker({
  options,
  provider,
  onProviderChange,
  isLocked = false,
}: LiveProviderPickerProps) {
  return (
    <div role="radiogroup" aria-label="Live provider" className="grid gap-1">
      {options.map((option) => {
        const isSelected = option.id === provider;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isLocked}
            onClick={() => onProviderChange(option.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isSelected
                ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <ProviderIcon option={option} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-5">{option.label}</span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {option.transport.toUpperCase()} · {option.description}
              </span>
            </span>
            {isSelected && <Check className="h-4 w-4 text-zinc-500" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
