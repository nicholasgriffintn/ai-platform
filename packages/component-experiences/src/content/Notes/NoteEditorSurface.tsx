import { cn } from "@ngriffin_uk/polychat-component-ui";
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
  children,
}: NoteEditorSurfaceProps) {
  const [showMetadata, setShowMetadata] = useState(false);

  return (
    <div className="relative flex flex-col flex-1 h-full">
      <output aria-live="polite" className="absolute top-4 right-4 z-20">
        <div
          className={cn(
            "w-2 h-2 sm:w-3 sm:h-3 rounded-full",
            isSaving
              ? "bg-active-work animate-pulse ring-2 ring-active-work/45"
              : "bg-border-strong ring-border ring-1",
          )}
          title={isSaving ? "Saving..." : "All changes saved"}
        />
        <span className="sr-only">{isSaving ? "Saving..." : "All changes saved"}</span>
      </output>

      {hasMetadata && (
        <div className="border-b">
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={() => setShowMetadata(!showMetadata)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-black-800"
            >
              <Hash size={14} />
              Metadata
              <span className="text-xs">({showMetadata ? "hide" : "show"})</span>
            </button>
          </div>
          {showMetadata && <div className="px-4 pb-4">{metadataPanel}</div>}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Start typing..."
        className={cn(
          "flex-1 w-full p-4 focus:outline-none resize-none",
          fontFamily === "serif" ? "font-serif" : "font-sans",
        )}
        style={{ fontSize: `${fontSize}px` }}
      />

      {children}
    </div>
  );
}
