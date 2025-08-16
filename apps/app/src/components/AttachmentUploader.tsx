import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/Button";
import {
  useFileUpload,
  type FileWithPreview,
  formatBytes,
} from "~/hooks/use-file-upload";
import type { Attachment } from "~/types/note";
import { apiService } from "~/lib/api/api-service";
import { fetchApi } from "~/lib/api/fetch-wrapper";

interface AttachmentUploaderProps {
  value?: Attachment[];
  onChange?: (attachments: Attachment[]) => void;
  multiple?: boolean;
}

export default function AttachmentUploader({
  value = [],
  onChange,
  multiple = true,
}: AttachmentUploaderProps) {
  const [uploadingIds, setUploadingIds] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<Attachment[]>(value);

  const accept = useMemo(
    () =>
      [
        "image/*",
        "application/pdf",
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-msvideo",
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
      ].join(","),
    [],
  );

  const [
    { files, isDragging, errors },
    {
      removeFile,
      openFileDialog,
      getInputProps,
      handleDrop,
      handleDragEnter,
      handleDragLeave,
    },
  ] = useFileUpload({
    accept,
    multiple,
    maxFiles: multiple ? 10 : 1,
    onFilesAdded: async (added) => void uploadQueued(added),
  });

  useEffect(() => {
    onChange?.(attachments);
  }, [attachments, onChange]);

  async function uploadQueued(added: FileWithPreview[]) {
    for (const f of added) {
      if (!(f.file instanceof File)) continue;
      const form = new FormData();
      const type = f.file.type.startsWith("image/")
        ? "image"
        : f.file.type.startsWith("video/")
          ? "video"
          : f.file.type.startsWith("audio/")
            ? "audio"
            : "document";
      form.append("file", f.file);
      form.append("file_type", type);

      setUploadingIds((prev) => ({ ...prev, [f.id]: true }));

      let headers: Record<string, string> = {};
      try {
        headers = await apiService.getHeaders();
      } catch {}

      try {
        const res = await fetchApi("/uploads", {
          method: "POST",
          body: form,
          headers,
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = (await res.json()) as {
          url: string;
          type: Attachment["type"];
          name?: string;
          markdown?: string;
          size?: number;
          mimeType?: string;
          metadata?: Record<string, any>;
        };
        const att: Attachment = {
          url: data.url,
          type: data.type,
          name: data.name,
          size: data.size,
          mimeType: data.mimeType,
          metadata: data.metadata,
        };
        setAttachments((prev) => [...prev, att]);
      } catch (e) {
        // swallow; UI errors shown via errors state
      } finally {
        setUploadingIds((prev) => {
          const { [f.id]: _, ...rest } = prev;
          return rest;
        });
        removeFile(f.id);
      }
    }
  }

  return (
    <div
      className={`border rounded-md p-3 ${isDragging ? "ring-2 ring-blue-500" : ""}`}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Attachments</p>
          <p className="text-xs text-muted-foreground">
            Images, PDFs, audio, and video
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={openFileDialog} size="sm">
            Upload files
          </Button>
          <input {...getInputProps({ className: "sr-only" })} />
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-2 text-xs text-destructive">{errors[0]}</div>
      )}

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {attachments.map((att, idx) => (
          <div key={`${att.url}-${idx}`} className="border rounded p-2 text-xs">
            <div className="truncate font-medium" title={att.name || att.url}>
              {att.name || att.url}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                {att.type}
              </span>
              {att.size ? <span>{formatBytes(att.size)}</span> : null}
            </div>
            {att.metadata?.thumbnailUrl && (
              <img
                src={att.metadata.thumbnailUrl}
                alt={att.name || "thumbnail"}
                className="mt-2 h-24 w-full object-cover rounded"
              />
            )}
          </div>
        ))}

        {files.map((f) => (
          <div key={f.id} className="border rounded p-2 text-xs">
            <div
              className="truncate font-medium"
              title={(f.file as any).name || f.id}
            >
              {(f.file as any).name || f.id}
            </div>
            {f.preview && (f.file as File)?.type?.startsWith("image/") && (
              <img
                src={f.preview}
                alt="preview"
                className="mt-2 h-24 w-full object-cover rounded"
              />
            )}
            {uploadingIds[f.id] !== undefined && (
              <div className="mt-2 text-[10px] opacity-70">Uploading...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
