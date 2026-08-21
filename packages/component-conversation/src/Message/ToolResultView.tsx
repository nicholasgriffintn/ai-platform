import type {
  ResponseDisplay,
  ToolInteractionHandler,
} from "@ngriffin_uk/polychat-component-content";
import { ResponseView } from "@ngriffin_uk/polychat-component-content";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ToolResultDisplay } from "@ngriffin_uk/polychat-library-chat/tool-results";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

import { ToolIcon } from "./toolIcons";

interface ToolResultViewProps {
  display: ToolResultDisplay;
  input?: unknown;
  onToolInteraction?: ToolInteractionHandler;
  className?: string;
}

const STATUS_TONE: Record<string, string> = {
  error: "text-red-600 dark:text-red-400",
  failed: "text-red-600 dark:text-red-400",
  cancelled: "text-red-600 dark:text-red-400",
  pending: "text-amber-600 dark:text-amber-400",
  in_progress: "text-amber-600 dark:text-amber-400",
};

const formatInput = (input: unknown): string | null => {
  if (input === undefined || input === null || input === "") {
    return null;
  }

  if (typeof input === "string") {
    try {
      return JSON.stringify(JSON.parse(input), null, 2);
    } catch {
      return input;
    }
  }

  return JSON.stringify(input, null, 2);
};

export const ToolResultView = ({
  display,
  input,
  onToolInteraction,
  className,
}: ToolResultViewProps) => {
  const [showInput, setShowInput] = useState(false);
  const formattedInput = formatInput(input);
  const isRunning = display.status === "in_progress" || display.status === "pending";
  const tone = display.status ? STATUS_TONE[display.status] : undefined;

  return (
    <div className={cn("mb-2", className)} data-tool-name={display.name}>
      <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {isRunning ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-amber-500" />
        ) : (
          <ToolIcon
            icon={display.icon}
            size={14}
            className="shrink-0 text-zinc-500 dark:text-zinc-400"
          />
        )}
        <span className="truncate">{display.label}</span>
        {display.status && display.status !== "success" && (
          <span className={cn("shrink-0 font-normal", tone)}>({display.status})</span>
        )}
        {formattedInput && (
          <button
            type="button"
            onClick={() => setShowInput(!showInput)}
            className="ml-auto flex shrink-0 cursor-pointer items-center gap-0.5 font-normal text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            aria-expanded={showInput}
            aria-label={showInput ? "Hide tool arguments" : "Show tool arguments"}
          >
            {showInput ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>Arguments</span>
          </button>
        )}
      </div>

      {showInput && formattedInput && (
        <pre className="mt-1.5 overflow-x-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
          {formattedInput}
        </pre>
      )}

      {display.result && (
        <div className="mt-1">
          <ResponseView
            result={display.result}
            responseType={display.responseType}
            responseDisplay={display.responseDisplay as ResponseDisplay | undefined}
            renderer={display.renderer}
            embedded
            onToolInteraction={onToolInteraction}
          />
        </div>
      )}
    </div>
  );
};
