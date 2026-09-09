import { Textarea, cn } from "@ngriffin_uk/polychat-component-ui";
import { Hash } from "lucide-react";
import { type ReactNode, type RefObject, useState } from "react";

export interface NoteEditorSurfaceProps {
  text: string;
  onTextChange: (value: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  fontFamily: string;
  fontSize: number;
  isSaving: boolean;
  metadataPanel?: ReactNode;
  hasMetadata?: boolean;
  leading?: ReactNode;
  children?: ReactNode;
}

export function NoteEditorSurface({
  text,
  onTextChange,
  textareaRef,
  fontFamily,
  fontSize,
  isSaving,
  metadataPanel,
  hasMetadata = false,
  leading,
  children,
}: NoteEditorSurfaceProps) {
  const [showMetadata, setShowMetadata] = useState(false);

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <output aria-live="polite" className="absolute top-4 right-4 z-20">
        <div
          className={cn(
            "h-2 w-2 rounded-full sm:h-3 sm:w-3",
            isSaving
              ? "animate-pulse bg-active-work ring-2 ring-active-work/45"
              : "bg-border-strong ring-1 ring-border",
          )}
          title={isSaving ? "Saving..." : "All changes saved"}
        />
        <span className="sr-only">{isSaving ? "Saving..." : "All changes saved"}</span>
      </output>

      {leading}

      {hasMetadata && (
        <div className="border-b border-current/15">
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={() => setShowMetadata(!showMetadata)}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-current/75 transition-colors hover:bg-current/10 hover:text-current"
            >
              <Hash size={14} />
              Metadata
              <span className="text-xs text-current/70">({showMetadata ? "hide" : "show"})</span>
            </button>
          </div>
          {showMetadata && <div className="px-4 pb-4">{metadataPanel}</div>}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Start typing..."
        aria-label="Note text"
        className={cn(
          "flex-1 resize-none rounded-none border-0 bg-transparent p-4 focus:ring-0 focus-visible:ring-0",
          fontFamily === "serif" ? "font-serif" : "font-sans",
        )}
        style={{ fontSize: `${fontSize}px` }}
      />

      {children}
    </div>
  );
}
