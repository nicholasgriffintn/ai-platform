import { formatBytes } from "@ngriffin_uk/polychat-utility-core";
import { FileIcon, UploadIcon, XIcon } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";

import { Button } from "../Button";
import { Label } from "../label";
import { cn } from "../utils";

export interface FileDropzoneProps {
  label?: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  files: readonly File[];
  onFilesChange: (files: File[]) => void;
  fileNote?: (file: File) => string | null;
}

function fileKey(file: File): string {
  return `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
}

export function FileDropzone({
  label,
  hint,
  accept,
  multiple = false,
  disabled = false,
  files,
  onFilesChange,
  fileNote,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const total = files.reduce((sum, file) => sum + file.size, 0);

  const add = (incoming: FileList | null) => {
    const next = Array.from(incoming ?? []);

    if (next.length === 0) {
      return;
    }

    onFilesChange(multiple ? [...files, ...next] : next.slice(0, 1));
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);

    if (!disabled) {
      add(event.dataTransfer.files);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-2">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-dragging={dragging || undefined}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors",
          "hover:border-ring hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50 data-[dragging=true]:border-ring data-[dragging=true]:bg-muted/40",
        )}
      >
        <UploadIcon className="mb-1 size-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">
          {multiple ? "Drop files here or browse" : "Drop a file here or browse"}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {files.map((file) => {
            const note = fileNote?.(file) ?? null;

            return (
              <li key={fileKey(file)} className="flex items-center gap-3 px-3 py-2 text-sm">
                <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{file.webkitRelativePath || file.name}</span>
                  {note && <span className="block text-xs text-failure">{note}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatBytes(file.size, 1)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 min-h-7 min-w-7 p-1"
                  aria-label={`Remove ${file.name}`}
                  disabled={disabled}
                  onClick={() => onFilesChange(files.filter((item) => item !== file))}
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </Button>
              </li>
            );
          })}
          {multiple && files.length > 1 && (
            <li className="flex justify-between px-3 py-2 text-xs text-muted-foreground">
              <span>{files.length} files</span>
              <span className="tabular-nums">{formatBytes(total, 1)}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
