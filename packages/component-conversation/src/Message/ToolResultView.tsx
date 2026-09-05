import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
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
  error: "text-failure",
  failed: "text-failure",
  cancelled: "text-failure",
  pending: "text-attention",
  in_progress: "text-attention",
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
      <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground">
        {isRunning ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-attention" />
        ) : (
          <ToolIcon icon={display.icon} size={14} className="shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{display.label}</span>
        {display.status && display.status !== "success" && (
          <span className={cn("shrink-0 font-normal", tone)}>({display.status})</span>
        )}
        {formattedInput && (
          <button
            type="button"
            onClick={() => setShowInput(!showInput)}
            className="ml-auto flex shrink-0 cursor-pointer items-center gap-0.5 font-normal text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showInput}
            aria-label={showInput ? "Hide tool arguments" : "Show tool arguments"}
          >
            {showInput ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>Arguments</span>
          </button>
        )}
      </div>

      {showInput && formattedInput && (
        <pre className="border-border bg-surface-elevated text-foreground mt-1.5 overflow-x-auto rounded border p-2 text-xs">
          {formattedInput}
        </pre>
      )}

      {display.result && (
        <div className="mt-1">
          <ResponseView
            result={display.result}
            responseType={display.responseType}
            renderer={display.renderer}
            embedded
            onToolInteraction={onToolInteraction}
          />
        </div>
      )}
      {display.streamPreview ? (
        <output className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
          Showing a bounded live preview. The full stored output is available after this
          conversation refreshes.
        </output>
      ) : null}
    </div>
  );
};
