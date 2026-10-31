import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

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
  density?: "regular" | "compact" | "slim";
}

const SHELL_CLASS =
  "relative rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30 hover:border-border-strong";

function focusEditableInRow(event: MouseEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement | null;

  if (target?.closest("button, a, input, textarea, select, [contenteditable]")) {
    return;
  }

  event.preventDefault();
  const row = event.currentTarget;
  const editable = row.querySelector<HTMLElement>("[contenteditable], textarea");

  editable?.focus();
}

function GeneratingAudioNotice() {
  return (
    <output
      className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-active-work" aria-hidden="true" />
      <span>Generating response audio...</span>
    </output>
  );
}

function SlimComposerShell({
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
    <div data-chat-input-shell className={SHELL_CLASS}>
      <div className="flex flex-col">
        {chips}
        {fileInput}
        <div className="relative">
          {suggestions}
          <div className="flex items-center gap-1 py-1 pr-1.5 pl-1">
            {leadingControls && (
              <div className="flex min-w-0 items-center px-2">{leadingControls}</div>
            )}
            {input && (
              <div
                data-composer-input-row
                data-poly-anchor="composer"
                className="flex min-w-0 flex-1 cursor-text items-center py-1 pl-2.5"
                role="presentation"
                onMouseDown={focusEditableInRow}
              >
                {input}
              </div>
            )}
            {inputHelp && (
              <div id="message-input-help" className="sr-only">
                {inputHelp}
              </div>
            )}
            {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
          </div>
        </div>
        {(isGeneratingAudio || footerStart || footerEnd) && (
          <div className="px-2 pb-1.5">
            {isGeneratingAudio && <GeneratingAudioNotice />}
            {(footerStart || footerEnd) && (
              <div className="@container/composer-footer flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">{footerStart}</div>
                <div className="flex shrink-0 items-center gap-2">{footerEnd}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ComposerShell(props: ComposerShellProps) {
  const {
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
    density = "regular",
  } = props;

  if (density === "slim") {
    return <SlimComposerShell {...props} />;
  }

  const isCompact = density === "compact";

  return (
    <div data-chat-input-shell className={SHELL_CLASS}>
      <div className="flex flex-col">
        {chips}
        {fileInput}
        <div className="relative">
          {suggestions}
          <div className="flex items-stretch">
            {leadingControls && (
              <div className="flex min-h-[60px] min-w-0 flex-grow items-center px-4 py-3">
                {leadingControls}
              </div>
            )}
            {input && (
              <div
                data-composer-input-row
                data-poly-anchor="composer"
                className={cn(
                  "flex min-w-0 flex-1 cursor-text",
                  isCompact ? "items-center py-2 pl-3.5" : "px-4 pt-3 pb-5",
                )}
                role="presentation"
                onMouseDown={focusEditableInRow}
              >
                {input}
              </div>
            )}
            {inputHelp && (
              <div id="message-input-help" className="sr-only">
                {inputHelp}
              </div>
            )}
            {actions && (
              <div
                className={cn(
                  "flex flex-shrink-0",
                  isCompact ? "items-end py-1.5 pr-1.5 pl-2" : "items-start pt-3 pr-3",
                )}
              >
                <div className="flex items-center gap-1">{actions}</div>
              </div>
            )}
          </div>
        </div>

        {(isGeneratingAudio || footerStart || footerEnd) && (
          <div className="border-t border-border px-3 pt-3 pb-3">
            {isGeneratingAudio && <GeneratingAudioNotice />}
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
