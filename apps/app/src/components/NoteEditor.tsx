import {
  Copy,
  Download,
  Hash,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  MonitorDot,
  MonitorStop,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { NoteMetadata } from "~/components/NoteMetadata";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea as UITextarea,
} from "~/components/ui";
import { useNoteFormatter } from "~/hooks/useNoteFormatter";
import { useTabAudioCapture } from "~/hooks/useTabAudioCapture";
import { useTranscription } from "~/hooks/useTranscription";
import {
  formatTextWithSpacing,
  getCharCount,
  getWordCount,
  splitTitleAndContent,
} from "~/lib/text-utils";
import { cn } from "~/lib/utils";

interface NoteEditorProps {
  noteId?: string;
  initialText?: string;
  initialMetadata?: Record<string, any>;
  onSave: (
    title: string,
    content: string,
    metadata?: Record<string, any>,
  ) => Promise<string>;
  onDelete?: () => Promise<void>;
  onToggleFullBleed?: () => void;
  isFullBleed?: boolean;
  initialThemeMode?: string;
  onThemeChange?: (mode: string) => void;
  initialFontFamily?: string;
  onFontFamilyChange?: (fontFamily: string) => void;
  initialFontSize?: number;
  onFontSizeChange?: (fontSize: number) => void;
}

export function NoteEditor({
  noteId,
  initialText = "",
  initialMetadata,
  onSave,
  onDelete,
  onToggleFullBleed,
  isFullBleed = false,
  initialThemeMode = "sepia",
  onThemeChange,
  initialFontFamily = "Sans",
  onFontFamilyChange,
  initialFontSize = 25,
  onFontSizeChange,
}: NoteEditorProps) {
  const [text, setText] = useState<string>(initialText);
  const [fontFamily, setFontFamily] = useState<string>(initialFontFamily);
  const [themeMode, setThemeMode] = useState<string>(initialThemeMode);
  const [fontSize, setFontSize] = useState<number>(initialFontSize);
  const [lastSavedText, setLastSavedText] = useState<string>(initialText);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [partialTranscript, setPartialTranscript] = useState<string>("");
  const [isSpeechDetected, setIsSpeechDetected] = useState<boolean>(false);
  const [lastSilenceTime, setLastSilenceTime] = useState<number>(0);
  const [currentMetadata, setCurrentMetadata] = useState<Record<string, any>>(
    initialMetadata || {},
  );
  const [showMetadata, setShowMetadata] = useState<boolean>(false);

  const handleMetadataUpdate = async (newMetadata: Record<string, any>) => {
    setCurrentMetadata(newMetadata);

    if (noteId) {
      setIsSaving(true);
      try {
        const [title, content] = splitTitleAndContent(textRef.current);
        const tabMetadata = tabCapture.tabInfo
          ? { tabSource: tabCapture.tabInfo }
          : {};
        const finalMetadata = { ...newMetadata, ...tabMetadata };
        await onSave(title, content, finalMetadata);
      } catch {
        toast.error("Failed to save metadata changes");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const {
    isAIModalOpen,
    setIsAIModalOpen,
    aiPrompt,
    setAIPrompt,
    aiResult,
    formatNoteMutation,
    runFormat,
    openFormatModal,
  } = useNoteFormatter(noteId ?? "");

  const tabCapture = useTabAudioCapture();

  const {
    isTranscribing,
    status: transcriptionStatus,
    startTranscription,
    stopTranscription,
  } = useTranscription({
    onTranscriptionReceived: (newText, isPartial) => {
      if (isPartial) {
        setPartialTranscript((prev) => formatTextWithSpacing(prev, newText));
      } else {
        setPartialTranscript("");
        setText((prev) => formatTextWithSpacing(prev, newText));
      }
    },
    onSpeechDetected: (isActive) => {
      console.log("Speech detection update:", isActive);
      setIsSpeechDetected(isActive);
      if (!isActive) {
        setLastSilenceTime(Date.now());
      }
    },
  });

  const textRef = useRef(text);
  const lastSavedRef = useRef(lastSavedText);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    lastSavedRef.current = lastSavedText;
  }, [lastSavedText]);

  const wordCount = getWordCount(text);
  const charCount = getCharCount(text);

  useEffect(() => {
    setText(initialText);
    setLastSavedText(initialText);
  }, [initialText]);

  useEffect(() => {
    setThemeMode(initialThemeMode);
  }, [initialThemeMode]);

  useEffect(() => {
    if (text === lastSavedText) return;
    const timeout = setTimeout(() => {
      (async () => {
        setIsSaving(true);
        try {
          const [title, content] = splitTitleAndContent(text);
          const tabMetadata = tabCapture.tabInfo
            ? { tabSource: tabCapture.tabInfo }
            : {};
          const finalMetadata = { ...currentMetadata, ...tabMetadata };
          await onSave(title, content, finalMetadata);
          setLastSavedText(text);
        } catch {
          toast.error("Failed to save note");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [text, lastSavedText, onSave, tabCapture.tabInfo, currentMetadata]);

  useEffect(() => {
    setFontFamily(initialFontFamily);
  }, [initialFontFamily]);

  useEffect(() => {
    setFontSize(initialFontSize);
  }, [initialFontSize]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        if (textRef.current !== lastSavedRef.current) {
          setIsSaving(true);
          (async () => {
            try {
              const [title, content] = splitTitleAndContent(textRef.current);
              const tabMetadata = tabCapture.tabInfo
                ? { tabSource: tabCapture.tabInfo }
                : {};
              const finalMetadata = { ...currentMetadata, ...tabMetadata };
              await onSave(title, content, finalMetadata);
              setLastSavedText(textRef.current);
            } catch {
              toast.error("Failed to save note");
            } finally {
              setIsSaving(false);
            }
          })();
        }
      }
      if (e.key === "Escape" && isFullBleed) {
        onToggleFullBleed?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isFullBleed,
    onSave,
    onToggleFullBleed,
    tabCapture.tabInfo,
    currentMetadata,
  ]);

  return (
    <div className="relative flex flex-col flex-1 h-full">
      <output aria-live="polite" className="absolute top-4 right-4 z-20">
        <div
          className={cn(
            "w-2 h-2 sm:w-3 sm:h-3 rounded-full",
            isSaving
              ? "bg-blue-400 dark:bg-blue-600 animate-pulse ring-2 ring-blue-300 dark:ring-blue-500"
              : "bg-gray-400 dark:bg-gray-600 ring-1 ring-gray-300 dark:ring-gray-500",
          )}
          title={isSaving ? "Saving..." : "All changes saved"}
        />
        <span className="sr-only">
          {isSaving ? "Saving..." : "All changes saved"}
        </span>
      </output>

      {currentMetadata && Object.keys(currentMetadata).length > 0 && (
        <div className="border-b">
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={() => setShowMetadata(!showMetadata)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black-800 dark:hover:text-black-200"
            >
              <Hash size={14} />
              Metadata
              <span className="text-xs">
                ({showMetadata ? "hide" : "show"})
              </span>
            </button>
          </div>
          {showMetadata && (
            <div className="px-4 pb-4">
              <NoteMetadata
                metadata={currentMetadata}
                onMetadataUpdate={handleMetadataUpdate}
                isEditable={!!noteId}
              />
            </div>
          )}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start typing..."
        className={cn(
          "flex-1 w-full p-4 focus:outline-none resize-none",
          fontFamily === "serif" ? "font-serif" : "font-sans",
        )}
        style={{ fontSize: `${fontSize}px` }}
      />
      {isTranscribing && (
        <div
          className="absolute bottom-16 left-4 right-4 p-3 bg-gray-100 dark:bg-gray-800 rounded shadow-md border border-gray-200 dark:border-gray-700 max-h-32 overflow-y-auto"
          aria-live="polite"
        >
          <div className="flex items-center mb-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium mr-2">Status:</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs",
                transcriptionStatus === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  : transcriptionStatus === "connecting"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                    : transcriptionStatus === "reconnecting"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
              )}
            >
              {transcriptionStatus === "active"
                ? "Active"
                : transcriptionStatus === "connecting"
                  ? "Connecting..."
                  : transcriptionStatus === "reconnecting"
                    ? "Reconnecting..."
                    : "Error"}
            </span>
            <div className="ml-auto flex items-center">
              {isSpeechDetected ? (
                <span className="flex items-center text-green-600 dark:text-green-400">
                  <Volume2 size={14} className="mr-1 animate-pulse" />
                  Speech detected
                </span>
              ) : (
                <span className="flex items-center text-gray-500 dark:text-gray-400">
                  <VolumeX size={14} className="mr-1" />
                  Silence{" "}
                  {lastSilenceTime
                    ? `(${Math.floor((Date.now() - lastSilenceTime) / 1000)}s)`
                    : ""}
                </span>
              )}
            </div>
          </div>
          {partialTranscript ? (
            <p className="text-sm opacity-70 italic">{partialTranscript}</p>
          ) : (
            <p className="text-sm opacity-50 text-gray-500 dark:text-gray-400 animate-pulse">
              {isSpeechDetected ? "Listening..." : "Waiting for speech..."}
            </p>
          )}
        </div>
      )}
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
            onChange={(e) => {
              const value = e.target.value;
              setFontFamily(value);
              onFontFamilyChange?.(value);
            }}
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
            onChange={(e) => {
              setThemeMode(e.target.value);
              onThemeChange?.(e.target.value);
            }}
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
              onChange={(e) => {
                const value = +e.target.value;
                setFontSize(value);
                onFontSizeChange?.(value);
              }}
              className="mx-2"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <button
            type="button"
            disabled={!noteId}
            onClick={openFormatModal}
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
            onClick={() => {
              if (isTranscribing) {
                stopTranscription(true);
                setPartialTranscript("");
                setIsSpeechDetected(false);
                setLastSilenceTime(0);
              } else {
                startTranscription();
              }
            }}
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
            <Mic
              size={16}
              className={isSpeechDetected ? "animate-pulse" : ""}
            />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (tabCapture.isCapturing) {
                stopTranscription(true);
                tabCapture.stop();
                setPartialTranscript("");
                setIsSpeechDetected(false);
                setLastSilenceTime(0);
              } else {
                const stream = await tabCapture.start();
                if (stream) {
                  startTranscription(stream);
                }
              }
            }}
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
            onClick={() => {
              navigator.clipboard
                .writeText(text)
                .then(() => {
                  toast.success("Copied to clipboard");
                })
                .catch(() => {
                  toast.error("Failed to copy to clipboard");
                });
            }}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Copy text"
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([text], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "note.txt";
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Downloaded note");
            }}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Download note"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (onDelete) {
                if (
                  window.confirm("Are you sure you want to delete this note?")
                ) {
                  void onDelete();
                }
              } else {
                setText("");
              }
            }}
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
            onClick={() => onToggleFullBleed?.()}
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

      <Dialog
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        width="600px"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Formatting</DialogTitle>
            <DialogDescription>
              Review and re-prompt AI suggestions
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            {formatNoteMutation.status === "idle" ? (
              <>
                <p className="text-sm">
                  This feature restructures and refines your note for clarity
                  and organization.
                </p>
                <p className="text-sm">
                  Add additional instructions below, then click Run to format.
                </p>
              </>
            ) : (
              <div className="mb-4 h-48 border rounded">
                {formatNoteMutation.status === "pending" ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin text-gray-500" />
                  </div>
                ) : formatNoteMutation.status === "error" ? (
                  <p className="text-red-500 p-4">
                    Formatting failed. Try again.
                  </p>
                ) : (
                  <>
                    <label htmlFor="ai-result" className="sr-only">
                      AI Result
                    </label>
                    <UITextarea
                      id="ai-result"
                      value={aiResult}
                      readOnly
                      className="h-full"
                    />
                  </>
                )}
              </div>
            )}
            <label htmlFor="ai-prompt" className="sr-only">
              Additional instructions
            </label>
            <UITextarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              placeholder="Add more instructions..."
              className="mb-4 h-24"
            />
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={runFormat}
                isLoading={formatNoteMutation.status === "pending"}
                disabled={!noteId || formatNoteMutation.status === "pending"}
                className="mr-2"
              >
                {formatNoteMutation.status === "pending"
                  ? "Running..."
                  : "Run Formatting"}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setText(aiResult);
                  setIsAIModalOpen(false);
                }}
                disabled={formatNoteMutation.status !== "success"}
              >
                Accept
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
