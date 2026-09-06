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
}: ComposerShellProps) {
  return (
    <div
      data-chat-input-shell
      className="relative rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30 hover:border-border-strong"
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
              <div className="flex flex-shrink-0 items-center gap-1 pt-3 pr-3">{actions}</div>
            )}
          </div>
        </div>

        {(isGeneratingAudio || footerStart || footerEnd) && (
          <div className="mt-2 border-t border-border px-3 pt-3 pb-3">
            {isGeneratingAudio && (
              <div
                className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
                role="status"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-active-work" aria-hidden="true" />
                <span>Generating response audio...</span>
              </div>
            )}
            {(footerStart || footerEnd) && (
              <div className="@container/composer-footer flex items-center justify-between gap-1 sm:gap-2">
                <div className="flex max-w-[70%] min-w-0 flex-1 items-center gap-2 sm:max-w-none">
                  {footerStart}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">{footerEnd}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
