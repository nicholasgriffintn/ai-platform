import { cn } from "@ngriffin_uk/polychat-component-ui";
import type {
  RealtimeLiveProviderId,
  RealtimeLiveProviderOption,
} from "@ngriffin_uk/polychat-library-realtime/live-providers";
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
  onProviderChange: (providerId: RealtimeLiveProviderId) => void;
  isLocked?: boolean;
  isLoading?: boolean;
}

export function LiveProviderPicker({
  options,
  provider,
  onProviderChange,
  isLocked = false,
  isLoading = false,
}: LiveProviderPickerProps) {
  if (isLoading) {
    return (
      <output className="block px-2 py-3 text-sm text-muted-foreground">
        Loading realtime providers…
      </output>
    );
  }

  if (options.length === 0) {
    return (
      <output className="block px-2 py-3 text-sm text-muted-foreground">
        No realtime providers are available.
      </output>
    );
  }

  return (
    <div role="radiogroup" aria-label="Live provider" className="grid gap-1">
      {options.map((option) => {
        const isSelected = option.id === provider;
        const isReady = option.readiness === "ready";

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isLocked || !isReady}
            title={isReady ? undefined : option.availabilityReason}
            onClick={() => onProviderChange(option.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isSelected
                ? "bg-selection text-foreground"
                : "text-foreground hover:bg-surface-elevated",
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <ProviderIcon option={option} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-5">{option.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {isReady
                  ? `${option.transport.toUpperCase()} · ${option.description}`
                  : option.availabilityReason}
              </span>
            </span>
            {isSelected && <Check className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
