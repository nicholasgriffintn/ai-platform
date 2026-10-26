import {
  Button,
  cn,
  ConfirmationDialog,
  OptionsMenu,
  OptionsMenuAction,
  OptionsMenuSeparator,
} from "@ngriffin_uk/polychat-component-ui";
import {
  Copy,
  Download,
  Eraser,
  Mic,
  MonitorDot,
  MonitorUp,
  MoreHorizontal,
  Sparkles,
  TvMinimalPlay,
} from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NoteReadingSettings, type NoteFontFamily, type NotePaper } from "./NoteReadingSettings";

interface NoteEditorToolbarProps {
  fontFamily: NoteFontFamily;
  onFontFamilyChange: (fontFamily: NoteFontFamily) => void;
  paper: NotePaper;
  onPaperChange: (paper: NotePaper) => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
  text: string;
  wordCount: number;
  charCount: number;
  canAssist: boolean;
  onClearText: () => void;
  onOpenMediaModal: () => void;
  onOpenFormatModal: () => void;
  isTranscribing: boolean;
  transcriptionStatus: string;
  isSpeechDetected: boolean;
  onTranscriptionToggle: () => void;
  isCapturingTab: boolean;
  onTabCaptureToggle: () => void;
}

function ToolButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "iconActive" : "icon"}
      size="sm"
      icon={icon}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={className}
    />
  );
}

export const NoteEditorToolbar = memo(function NoteEditorToolbar({
  fontFamily,
  onFontFamilyChange,
  paper,
  onPaperChange,
  fontSize,
  onFontSizeChange,
  text,
  wordCount,
  charCount,
  canAssist,
  onClearText,
  onOpenMediaModal,
  onOpenFormatModal,
  isTranscribing,
  transcriptionStatus,
  isSpeechDetected,
  onTranscriptionToggle,
  isCapturingTab,
  onTabCaptureToggle,
}: NoteEditorToolbarProps) {
  const [isClearing, setIsClearing] = useState(false);
  const isConnecting =
    transcriptionStatus === "connecting" || transcriptionStatus === "reconnecting";

  const copy = () =>
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied the note"))
      .catch(() => toast.error("The note didn't copy"));

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = "note.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="toolbar"
      aria-label="Note tools"
      className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1.5 sm:px-3"
    >
      <NoteReadingSettings
        fontFamily={fontFamily}
        onFontFamilyChange={onFontFamilyChange}
        paper={paper}
        onPaperChange={onPaperChange}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
      />

      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolButton
        label={isTranscribing ? "Stop dictating" : "Dictate"}
        icon={<Mic size={16} />}
        active={isTranscribing}
        onClick={onTranscriptionToggle}
        className={cn(
          isTranscribing && isSpeechDetected && "text-success",
          isTranscribing && isConnecting && "animate-pulse",
          transcriptionStatus === "error" && "text-failure",
        )}
      />
      <ToolButton
        label={isCapturingTab ? "Stop transcribing the tab" : "Transcribe a browser tab"}
        icon={isCapturingTab ? <MonitorDot size={16} /> : <MonitorUp size={16} />}
        active={isCapturingTab}
        onClick={onTabCaptureToggle}
        className={isCapturingTab ? "animate-pulse" : undefined}
      />
      <ToolButton
        label="Notes from a recording link"
        icon={<TvMinimalPlay size={16} />}
        onClick={onOpenMediaModal}
      />
      <ToolButton
        label="Rework with AI"
        icon={<Sparkles size={16} />}
        disabled={!canAssist}
        onClick={onOpenFormatModal}
      />

      <OptionsMenu
        side="top"
        align="start"
        sideOffset={8}
        trigger={
          <Button
            type="button"
            variant="icon"
            size="sm"
            icon={<MoreHorizontal size={16} />}
            aria-label="More note actions"
            title="More"
          />
        }
      >
        <OptionsMenuAction onSelect={() => void copy()}>
          <Copy size={14} aria-hidden="true" />
          Copy text
        </OptionsMenuAction>
        <OptionsMenuAction onSelect={download}>
          <Download size={14} aria-hidden="true" />
          Download as Markdown
        </OptionsMenuAction>
        <OptionsMenuSeparator />
        <OptionsMenuAction
          disabled={!text}
          className="text-failure data-[highlighted]:text-failure"
          onSelect={() => setIsClearing(true)}
        >
          <Eraser size={14} aria-hidden="true" />
          Clear the note
        </OptionsMenuAction>
      </OptionsMenu>

      <span className="ml-auto px-2 text-xs text-muted-foreground tabular-nums">
        {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount}{" "}
        {charCount === 1 ? "character" : "characters"}
      </span>

      <ConfirmationDialog
        open={isClearing}
        onOpenChange={setIsClearing}
        onConfirm={() => {
          onClearText();
          setIsClearing(false);
        }}
        title="Clear this note?"
        description="The text goes, but the last saved version stays in Version history."
        confirmText="Clear"
        variant="destructive"
      />
    </div>
  );
});
