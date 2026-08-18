import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { ModelIcon } from "../ModelIcon/ModelIcon";

export interface ModelSelectorLoadingState {
  message?: string;
  progress?: number;
  title?: string;
}

export interface ModelSelectorTriggerProps {
  isOpen: boolean;
  disabled?: boolean;
  minimal?: boolean;
  mono?: boolean;
  /** Present while a local model initialises; replaces the model identity with progress. */
  loading?: ModelSelectorLoadingState | null;
  /** Rendered in place of the model icon, for example the automatic router mode glyph. */
  icon?: ReactNode;
  modelName?: string;
  modelProvider?: string;
  label: ReactNode;
  title: string;
  onToggle: () => void;
}

export function ModelSelectorTrigger({
  isOpen,
  disabled,
  minimal = false,
  mono = false,
  loading,
  icon,
  modelName,
  modelProvider,
  label,
  title,
  onToggle,
}: ModelSelectorTriggerProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label="Select a model"
      className={`cursor-pointer disabled:cursor-not-allowed flex items-center gap-2 rounded-md w-full ${minimal ? "px-2 py-1" : "px-3 py-1.5"} bg-off-white-highlight dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors`}
    >
      {loading ? (
        <div className="flex items-center gap-2 w-full min-w-0">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          {!minimal && (
            <span className="text-sm max-w-[250px] truncate w-full" title={loading.title}>
              {loading.message} {loading.progress !== undefined && `(${loading.progress}%)`}
            </span>
          )}
        </div>
      ) : (
        <>
          {icon ?? (
            <ModelIcon modelName={modelName || ""} provider={modelProvider} size={18} mono={mono} />
          )}
          {!minimal && (
            <span className="text-sm max-w-[250px] truncate w-full" title={title}>
              {label}
            </span>
          )}
        </>
      )}
      {isOpen ? (
        <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
