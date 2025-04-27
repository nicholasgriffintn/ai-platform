import { Copy, Download, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/utils";

interface NoteEditorProps {
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

  // Refs to hold latest values for keyboard shortcuts
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
            focus:outline-none
            focus-visible:ring
            focus-visible:ring-blue-500
            focus-visible:ring-offset-2
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
    </div>
  );
}
