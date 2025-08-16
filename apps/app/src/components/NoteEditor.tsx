import {
  Copy,
  Download,
  Hash,
  Maximize2,
  Mic,
  Minimize2,
  MonitorDot,
  MonitorStop,
  Trash2,
  Volume2,
  VolumeX,
  TvMinimalPlay,
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
import { useGenerateNotesFromMedia } from "~/hooks/useNotes";
import { useTabAudioCapture } from "~/hooks/useTabAudioCapture";
import { useTranscription } from "~/hooks/useTranscription";
import {
  formatTextWithSpacing,
  getCharCount,
  getWordCount,
  splitTitleAndContent,
} from "~/lib/text-utils";
import { cn } from "~/lib/utils";
import AttachmentUploader from "~/components/AttachmentUploader";
import AttachmentViewer from "~/components/AttachmentViewer";
import type { Attachment } from "~/types/note";

interface NoteEditorProps {
  noteId?: string;
  initialText?: string;
  initialMetadata?: Record<string, any>;
  initialAttachments?: Attachment[];
  onSave: (
    title: string,
    content: string,
    metadata?: Record<string, any>,
    attachments?: Attachment[],
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
  initialAttachments = [],
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
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);
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
        await onSave(title, content, finalMetadata, attachmentsRef.current);
      } catch {
        toast.error("Failed to save metadata changes");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // AI formatting modal removed

  const generateNotesMutation = useGenerateNotesFromMedia();
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>([
    "concise_summary",
  ]);
  const [noteType, setNoteType] = useState<string>("general");
  const [extraPrompt, setExtraPrompt] = useState<string>("");
  const [withTimestamps, setWithTimestamps] = useState<boolean>(false);

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
  const attachmentsRef = useRef(attachments);
  const lastSavedAttachmentsRef = useRef<string>(
    JSON.stringify(initialAttachments || []),
  );

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    lastSavedRef.current = lastSavedText;
  }, [lastSavedText]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

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
          await onSave(title, content, finalMetadata, attachmentsRef.current);
          setLastSavedText(text);
          lastSavedAttachmentsRef.current = JSON.stringify(
            attachmentsRef.current || [],
          );
        } catch {
          toast.error("Failed to save note");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [
    text,
    lastSavedText,
    onSave,
    tabCapture.tabInfo,
    currentMetadata,
  ]);

  useEffect(() => {
    setFontFamily(initialFontFamily);
  }, [initialFontFamily]);

  useEffect(() => {
    setFontSize(initialFontSize);
  }, [initialFontSize]);

  // Initialize attachments only when switching notes
  useEffect(() => {
    setAttachments(initialAttachments || []);
    lastSavedAttachmentsRef.current = JSON.stringify(
      initialAttachments || [],
    );
  }, [noteId]);

  // Save when attachments actually change (deep compare), debounced
  useEffect(() => {
    if (!noteId) return;
    const serialized = JSON.stringify(attachmentsRef.current || []);
    if (serialized === lastSavedAttachmentsRef.current) return;
    const timeout = setTimeout(() => {
      (async () => {
        setIsSaving(true);
        try {
          const [title, content] = splitTitleAndContent(textRef.current);
          const tabMetadata = tabCapture.tabInfo
            ? { tabSource: tabCapture.tabInfo }
            : {};
          const finalMetadata = { ...currentMetadata, ...tabMetadata };
          await onSave(title, content, finalMetadata, attachmentsRef.current);
          lastSavedAttachmentsRef.current = serialized;
        } catch {
          toast.error("Failed to save attachments");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 500);
    return () => clearTimeout(timeout);
  }, [attachments, noteId, onSave, currentMetadata, tabCapture.tabInfo]);

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
              await onSave(
                title,
                content,
                finalMetadata,
                attachmentsRef.current,
              );
              setLastSavedText(textRef.current);
              lastSavedAttachmentsRef.current = JSON.stringify(
                attachmentsRef.current || [],
              );
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

      <div className="px-4 py-3 border-b">
        <AttachmentUploader
          value={attachments}
          onChange={setAttachments}
          multiple
        />
        {attachments.length > 0 && (
          <div className="mt-3">
            <AttachmentViewer attachments={attachments} view="grid" />
          </div>
        )}
      </div>

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
                  Silence {lastSilenceTime ? `(${Math.floor((Date.now() - lastSilenceTime) / 1000)}s)` : ""}
                </span>
              )}
            </div>
          </div>
          {partialTranscript ? (
            <p className="text-sm opacity-70 text-gray-500 dark:text-gray-400 italic">
              {partialTranscript}
            </p>
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
            onClick={() => setIsMediaModalOpen(true)}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Generate notes from media URL"
            title="Generate notes from media URL"
          >
            <TvMinimalPlay size={16} />
          </button>
          {/* AI formatting button removed */}
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
        open={isMediaModalOpen}
        onOpenChange={setIsMediaModalOpen}
        width="700px"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Notes from Media URL</DialogTitle>
            <DialogDescription>
              Provide an audio/video URL, choose outputs, and generate
              structured notes.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <label htmlFor="media-url" className="sr-only">
              Media URL
            </label>
            <input
              id="media-url"
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://example.com/audio-or-video.mp3"
              className="w-full border rounded p-2 bg-transparent"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-sm font-medium">Outputs</span>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {[
                    { id: "concise_summary", label: "Concise summary" },
                    { id: "detailed_outline", label: "Detailed outline" },
                    { id: "key_takeaways", label: "Key takeaways" },
                    { id: "action_items", label: "Action items" },
                    { id: "meeting_minutes", label: "Meeting minutes" },
                    { id: "qa_extraction", label: "Q&A extraction" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOutputs.includes(opt.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedOutputs((prev) =>
                            checked
                              ? Array.from(new Set([...prev, opt.id]))
                              : prev.filter((v) => v !== opt.id),
                          );
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="note-type" className="text-sm font-medium">
                  Note type
                </label>
                <select
                  id="note-type"
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="mt-2 w-full bg-transparent border rounded p-2"
                >
                  {[
                    "general",
                    "meeting",
                    "training",
                    "lecture",
                    "interview",
                    "podcast",
                    "webinar",
                    "tutorial",
                    "other",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <label
                  htmlFor="timestamps"
                  className="mt-3 flex items-center gap-2 text-sm"
                >
                  <input
                    id="timestamps"
                    type="checkbox"
                    checked={withTimestamps}
                    onChange={(e) => setWithTimestamps(e.target.checked)}
                  />
                  Include timestamps
                </label>
              </div>
            </div>

            <label htmlFor="extra-prompt" className="text-sm font-medium">
              Additional instructions
            </label>
            <UITextarea
              id="extra-prompt"
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="Add any specifics to guide the output..."
              className="h-24"
            />

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!mediaUrl || selectedOutputs.length === 0) {
                    toast.error("Provide a URL and select at least one output");
                    return;
                  }
                  try {
                    const result = await generateNotesMutation.mutateAsync({
                      url: mediaUrl,
                      outputs: selectedOutputs as any,
                      noteType: noteType as any,
                      extraPrompt,
                      timestamps: withTimestamps,
                    });
                    setText((prev) =>
                      formatTextWithSpacing(prev, `\n\n${result.content}`),
                    );
                    setIsMediaModalOpen(false);
                    toast.success("Generated notes added to editor");
                  } catch {
                    toast.error("Failed to generate notes from URL");
                  }
                }}
                isLoading={generateNotesMutation.status === "pending"}
                disabled={generateNotesMutation.status === "pending"}
                className="mr-2"
              >
                {generateNotesMutation.status === "pending"
                  ? "Generating..."
                  : "Generate"}
              </Button>
              <Button
                variant="primary"
                onClick={() => setIsMediaModalOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI formatting modal removed */}
    </div>
  );
}
