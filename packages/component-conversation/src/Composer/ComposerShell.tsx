import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export interface ComposerShellProps {
  chips?: ReactNode;
  fileInput?: ReactNode;
  suggestions?: ReactNode;
  leadingControls?: ReactNode;
  input?: ReactNode;
  inputHelp?: ReactNode;
  actions?: ReactNode;
  isGeneratingAudio?: boolean;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  footerOverride?: ReactNode;
}

export function ComposerShell({
  chips,
  fileInput,
  suggestions,
  leadingControls,
  input,
  inputHelp,
  actions,
  isGeneratingAudio = false,
  footerStart,
  footerEnd,
  footerOverride,
}: ComposerShellProps) {
  return (
    <div
      data-chat-input-shell
      className="border-border bg-card text-card-foreground hover:border-border-strong focus-within:border-ring focus-within:ring-ring/30 relative rounded-lg border shadow-sm transition-[border-color,box-shadow] focus-within:ring-[3px]"
    >
      <div className="flex flex-col">
        {chips}
        {fileInput}
        <div className="relative">
          {suggestions}
          <div className="flex items-start">
            {leadingControls && (
              <div className="flex min-h-[60px] min-w-0 flex-grow items-center px-4 py-3">
                {leadingControls}
              </div>
            )}
            {input && (
              <div data-composer-input-row className="flex min-w-0 flex-grow px-4 py-3">
                {input}
              </div>
            )}
            {inputHelp && (
              <div id="message-input-help" className="sr-only">
                {inputHelp}
              </div>
            )}
            {actions && (
              <div className="flex flex-shrink-0 items-center gap-1 pr-3 pt-3">{actions}</div>
            )}
          </div>
        </div>

        <div className="border-border mt-2 border-t px-3 pt-3 pb-3">
          {isGeneratingAudio && (
            <div
              className="text-muted-foreground mb-3 flex items-center gap-2 text-xs"
              aria-live="polite"
              role="status"
            >
              <Loader2 className="text-active-work h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Generating response audio...</span>
            </div>
          )}
          {footerOverride}
          {(footerStart || footerEnd) && (
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="flex-1 min-w-0 max-w-[70%] sm:max-w-none flex items-center gap-2">
                {footerStart}
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">{footerEnd}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
