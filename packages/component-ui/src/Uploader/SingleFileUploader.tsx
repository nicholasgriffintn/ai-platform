// Source: https://originui.com/file-upload

import { formatBytes } from "@ngriffin_uk/polychat-utility-core";
import {
  type FileMetadata,
  type FileWithPreview,
  useFileUpload,
} from "@ngriffin_uk/polychat-utility-react";
import { AlertCircleIcon, PaperclipIcon, UploadIcon, XIcon } from "lucide-react";
import type { DragEvent } from "react";

import { Button } from "../Button";

interface SingleFileUploaderProps {
  id: string;
  accept?: string;
  initialFiles?: FileMetadata[];
  maxSize?: number;
  label?: string;
  hint?: string;
  onFilesAdded?: (files: FileWithPreview[]) => void;
  onFilesChange?: (files: FileWithPreview[]) => void;
  onFilesDropped?: (files: FileList) => void;
  onFileRemove?: (files: FileWithPreview[]) => void;
}

export function SingleFileUploader({
  id,
  accept = "*",
  initialFiles,
  maxSize = 10 * 1024 * 1024, // 10MB default
  label = "Upload file",
  hint,
  onFilesAdded,
  onFilesChange,
  onFilesDropped,
  onFileRemove,
}: SingleFileUploaderProps) {
  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    maxFiles: 1,
    accept,
    maxSize,
    initialFiles,
    onFilesAdded,
    onFilesChange,
  });

  const file = files[0];

  const handleDropWithNotification = (event: DragEvent<HTMLButtonElement>) => {
    handleDrop(event);
    if (event.dataTransfer.files.length > 0) {
      onFilesDropped?.(event.dataTransfer.files);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    if (files.length > 0) {
      onFileRemove?.(files);
    }

    removeFile(fileId);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        tabIndex={0}
        onClick={openFileDialog}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            openFileDialog();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDropWithNotification}
        data-dragging={isDragging || undefined}
        className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-input p-4 transition-colors hover:bg-accent/50 has-disabled:pointer-events-none has-disabled:opacity-50 has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50"
      >
        <input
          {...getInputProps()}
          id={id}
          className="sr-only"
          aria-label="Upload file"
          disabled={Boolean(file)}
        />

        <div className="flex flex-col items-center justify-center text-center">
          <div
            className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
            aria-hidden="true"
          >
            <UploadIcon className="size-4 opacity-60" />
          </div>
          <p className="mb-1.5 text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {hint ?? `Drag & drop or click to browse (max. ${formatBytes(maxSize)})`}
          </p>
        </div>
      </button>

      {errors.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}

      {file && (
        <div className="space-y-2">
          <div
            key={file.id}
            className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <PaperclipIcon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{file.file.name}</p>
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="-me-2 size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
              onClick={() => handleRemoveFile(files[0]?.id)}
              aria-label="Remove file"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
