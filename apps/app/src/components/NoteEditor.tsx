import {
  Copy,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import { useFormatNote } from "~/hooks/useNotes";

import { cn } from "~/lib/utils";

interface NoteEditorProps {
  noteId?: string;
  initialText?: string;
  onSave: (title: string, content: string) => Promise<string>;
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
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPrompt, setAIPrompt] = useState<string>("");
  const [aiResult, setAIResult] = useState<string>("");
  const formatNoteMutation = useFormatNote(noteId ?? "");

  const runFormat = async () => {
    formatNoteMutation.reset();
    setAIResult("");
    try {
      const content = await formatNoteMutation.mutateAsync(aiPrompt);
      setAIResult(content);
    } catch {
      toast.error("Failed to format note");
    }
  };

  const textRef = useRef(text);
  const lastSavedRef = useRef(lastSavedText);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    lastSavedRef.current = lastSavedText;
  }, [lastSavedText]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

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
          const [firstLine, ...rest] = text.split("\n");
          await onSave(firstLine, rest.join("\n"));
          setLastSavedText(text);
        } catch {
          toast.error("Failed to save note");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [text, lastSavedText, onSave]);

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
              const [firstLine, ...rest] = textRef.current.split("\n");
              await onSave(firstLine, rest.join("\n"));
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
  }, [isFullBleed, onSave, onToggleFullBleed]);

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
            onClick={() => {
              if (!noteId) return;
              formatNoteMutation.reset();
              setAIResult("");
              setAIPrompt("");
              setIsAIModalOpen(true);
            }}
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
