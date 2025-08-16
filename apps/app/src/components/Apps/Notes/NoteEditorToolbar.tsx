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
import { memo } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/utils";

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
      if (window.confirm("Are you sure you want to delete this note?")) {
        void onDelete();
      }
    } else {
      onClearText?.();
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
        <button
          type="button"
          onClick={onOpenMediaModal}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Generate notes from media URL"
          title="Generate notes from media URL"
        >
          <TvMinimalPlay size={16} />
        </button>
        <button
          type="button"
          disabled={!noteId}
          onClick={onOpenFormatModal}
          aria-disabled={!noteId}
          className={cn(
            "p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            !noteId && "opacity-50 cursor-not-allowed",
          )}
          aria-label="AI Assist"
        >
          <Zap size={16} />
        </button>
        <button
          type="button"
          onClick={onTranscriptionToggle}
          aria-pressed={isTranscribing}
          className={cn(
            "p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            isTranscribing &&
              (isSpeechDetected
                ? "text-green-600 dark:text-green-400"
                : transcriptionStatus === "active"
                  ? "text-blue-600 dark:text-blue-400"
                  : transcriptionStatus === "connecting"
                    ? "text-yellow-600 dark:text-yellow-400 animate-pulse"
                    : transcriptionStatus === "reconnecting"
                      ? "text-orange-600 dark:text-orange-400 animate-pulse"
                      : transcriptionStatus === "error"
                        ? "text-red-600 dark:text-red-400"
                        : ""),
          )}
          aria-label={
            isTranscribing ? "Stop transcription" : "Start transcription"
          }
          title={
            isTranscribing
              ? isSpeechDetected
                ? "Speech detected - click to stop"
                : transcriptionStatus === "active"
                  ? "Listening - click to stop"
                  : transcriptionStatus === "connecting"
                    ? "Connecting..."
                    : transcriptionStatus === "reconnecting"
                      ? "Reconnecting..."
                      : transcriptionStatus === "error"
                        ? "Connection error - click to retry"
                        : "Stop transcription"
              : "Start transcription"
          }
        >
          <Mic size={16} className={isSpeechDetected ? "animate-pulse" : ""} />
        </button>
        <button
          type="button"
          onClick={onTabCaptureToggle}
          aria-pressed={tabCapture.isCapturing}
          className={cn(
            "p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-offset-2",
            tabCapture.isCapturing
              ? "text-purple-600 dark:text-purple-400"
              : "",
          )}
          aria-label={
            tabCapture.isCapturing
              ? "Stop tab audio transcription"
              : "Start tab audio transcription"
          }
        >
          {tabCapture.isCapturing ? (
            <MonitorDot size={16} className="animate-pulse" />
          ) : (
            <MonitorStop size={16} />
          )}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Copy text"
        >
          <Copy size={16} />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Download note"
        >
          <Download size={16} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className={cn(
            "p-1 rounded",
            onDelete
              ? "hover:bg-red-200 dark:hover:bg-red-800 hover:text-red-900 dark:hover:text-red-100"
              : "hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100",
          )}
          aria-label={onDelete ? "Delete note" : "Clear note"}
        >
          <Trash2 size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleFullBleed}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Toggle full screen mode"
          aria-pressed={isFullBleed}
        >
          {isFullBleed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <span>
          {wordCount} words, {charCount} characters
        </span>
      </div>
    </div>
  );
});
