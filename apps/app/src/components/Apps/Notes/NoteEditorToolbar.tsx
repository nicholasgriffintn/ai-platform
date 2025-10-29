import {
  Copy,
  Download,
  Maximize2,
  Mic,
  Minimize2,
  MonitorDot,
  MonitorStop,
  Trash2,
  TvMinimalPlay,
  Zap,
} from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/utils";
import { ActionButtons, ConfirmationDialog } from "~/components/ui";

interface NoteEditorToolbarProps {
  fontFamily: string;
  onFontFamilyChange: (fontFamily: string) => void;
  themeMode: string;
  onThemeChange: (mode: string) => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
  text: string;
  wordCount: number;
  charCount: number;
  noteId?: string;
  onDelete?: () => Promise<void>;
  onClearText?: () => void;
  onToggleFullBleed?: () => void;
  isFullBleed: boolean;
  onOpenMediaModal: () => void;
  onOpenFormatModal: () => void;
  isTranscribing: boolean;
  transcriptionStatus: string;
  isSpeechDetected: boolean;
  onTranscriptionToggle: () => void;
  tabCapture: {
    isCapturing: boolean;
    start: () => Promise<MediaStream | null>;
    stop: () => void;
  };
  onTabCaptureToggle: () => void;
}

export const NoteEditorToolbar = memo(function NoteEditorToolbar({
  fontFamily,
  onFontFamilyChange,
  themeMode,
  onThemeChange,
  fontSize,
  onFontSizeChange,
  text,
  wordCount,
  charCount,
  noteId,
  onDelete,
  onClearText,
  onToggleFullBleed,
  isFullBleed,
  onOpenMediaModal,
  onOpenFormatModal,
  isTranscribing,
  transcriptionStatus,
  isSpeechDetected,
  onTranscriptionToggle,
  tabCapture,
  onTabCaptureToggle,
}: NoteEditorToolbarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "note.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded note");
  };

  const handleDelete = () => {
    if (onDelete) {
      setShowDeleteConfirm(true);
    } else {
      onClearText?.();
    }
  };

  const confirmDelete = async () => {
    if (onDelete) {
      setIsDeleting(true);
      try {
        await onDelete();
        setShowDeleteConfirm(false);
      } catch (error) {
        toast.error("Failed to delete note");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Note editor toolbar"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-2 sm:px-4 py-2 border-t text-sm gap-2"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <label htmlFor="fontFamily" className="sr-only">
          Font
        </label>
        <select
          id="fontFamily"
          value={fontFamily}
          onChange={(e) => onFontFamilyChange(e.target.value)}
          className="bg-transparent"
        >
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
        </select>
        <label htmlFor="themeMode" className="sr-only">
          Theme
        </label>
        <select
          id="themeMode"
          value={themeMode}
          onChange={(e) => onThemeChange(e.target.value)}
          className="bg-transparent"
        >
          <option value="sepia">Sepia</option>
          <option value="normal">Normal</option>
        </select>
        <label htmlFor="fontSize" className="sr-only">
          Font Size
        </label>
        <div className="flex items-center">
          <span>{fontSize}</span>
          <input
            id="fontSize"
            type="range"
            min="10"
            max="72"
            value={fontSize}
            onChange={(e) => onFontSizeChange(+e.target.value)}
            className="mx-2"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <ActionButtons
          actions={[
            {
              id: "media",
              icon: <TvMinimalPlay size={16} />,
              label: "Generate notes from media URL",
              onClick: onOpenMediaModal,
            },
            {
              id: "ai-assist",
              icon: <Zap size={16} />,
              label: "AI Assist",
              onClick: onOpenFormatModal,
              disabled: !noteId,
            },
            {
              id: "transcription",
              icon: (
                <Mic
                  size={16}
                  className={isSpeechDetected ? "animate-pulse" : ""}
                />
              ),
              label: isTranscribing
                ? "Stop transcription"
                : "Start transcription",
              onClick: onTranscriptionToggle,
              variant: isTranscribing
                ? isSpeechDetected
                  ? "success"
                  : transcriptionStatus === "active"
                    ? "active"
                    : transcriptionStatus === "error"
                      ? "destructive"
                      : "default"
                : "default",
              className: cn(
                isTranscribing &&
                  (transcriptionStatus === "connecting" ||
                    transcriptionStatus === "reconnecting")
                  ? "animate-pulse"
                  : "",
              ),
            },
            {
              id: "tab-capture",
              icon: tabCapture.isCapturing ? (
                <MonitorDot size={16} className="animate-pulse" />
              ) : (
                <MonitorStop size={16} />
              ),
              label: tabCapture.isCapturing
                ? "Stop tab audio transcription"
                : "Start tab audio transcription",
              onClick: onTabCaptureToggle,
              variant: tabCapture.isCapturing ? "active" : "default",
            },
            {
              id: "copy",
              icon: <Copy size={16} />,
              label: "Copy text",
              onClick: handleCopy,
            },
            {
              id: "download",
              icon: <Download size={16} />,
              label: "Download note",
              onClick: handleDownload,
            },
            {
              id: "delete",
              icon: <Trash2 size={16} />,
              label: onDelete ? "Delete note" : "Clear note",
              onClick: handleDelete,
              variant: onDelete ? "destructive" : "default",
            },
            {
              id: "fullscreen",
              icon: isFullBleed ? (
                <Minimize2 size={16} />
              ) : (
                <Maximize2 size={16} />
              ),
              label: "Toggle full screen mode",
              onClick: onToggleFullBleed || (() => {}),
            },
          ]}
        />
        <span className="ml-2">
          {wordCount} words, {charCount} characters
        </span>
      </div>
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => setShowDeleteConfirm(open)}
        onConfirm={confirmDelete}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
});
