import { ImageModal } from "@ngriffin_uk/polychat-component-content";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Clock3 } from "lucide-react";

import type { CanvasMode } from "./types";
import { getCardAspectClass, getMediaPreview, getPlaceholderPaletteClass } from "./utils";

export interface CanvasRun {
  key: string;
  modelId: string;
  modelName: string;
  generationId?: string;
  status: "queued" | "processing" | "succeeded" | "completed" | "failed";
  output?: unknown;
  error?: string;
  createdAt?: string;
}

const statusStyles: Record<CanvasRun["status"], string> = {
  queued: "bg-active-work/12 text-active-work border-active-work/45",
  processing: "bg-attention/12 text-attention border-attention/45",
  succeeded: "bg-success/12 text-success border-success/45",
  completed: "bg-success/12 text-success border-success/45",
  failed: "bg-failure/12 text-failure border-failure/45",
};

export function GenerationCard({
  run,
  index,
  aspectRatio,
  mode,
}: {
  run: CanvasRun;
  index: number;
  aspectRatio?: string;
  mode: CanvasMode;
}) {
  const preview = getMediaPreview(run.output);
  const showPlaceholder = !preview && run.status !== "failed";
  const aspectClass = getCardAspectClass({ mode, aspectRatio, index });
  const paletteClass = getPlaceholderPaletteClass(index);

  return (
    <article className="border-border bg-surface/80 mb-4 break-inside-avoid rounded-2xl border p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{run.modelName}</h3>
          {run.createdAt && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(run.createdAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
            statusStyles[run.status],
          )}
        >
          {run.status}
        </span>
      </div>

      {showPlaceholder && (
        <div
          className={cn(
            "border-border relative overflow-hidden rounded-xl border bg-gradient-to-br",
            paletteClass,
            aspectClass,
          )}
        >
          <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-surface mix-blend-soft-light" />
          <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-surface mix-blend-soft-light" />
          <div className="absolute left-1/3 top-1/3 h-16 w-16 rounded-full bg-surface blur-md" />
          {(run.status === "queued" || run.status === "processing") && (
            <div className="absolute inset-0 flex items-center justify-center text-foreground">
              <Clock3 className="mr-2 h-4 w-4 animate-pulse" />
              <span className="text-xs font-medium">Waiting for output</span>
            </div>
          )}
        </div>
      )}

      {preview?.type === "image" && (
        <div className="border-border rounded-xl border">
          <ImageModal
            src={preview.url}
            alt={run.modelName}
            thumbnailClassName="block w-full"
            imageClassName="h-auto w-full rounded-xl object-contain"
            crossOrigin="use-credentials"
          />
        </div>
      )}

      {preview?.type === "video" && (
        <div className={cn("border-border overflow-hidden rounded-xl border", aspectClass)}>
          <video controls className="h-full w-full object-cover">
            <source src={preview.url} type="video/mp4" />
          </video>
        </div>
      )}

      {preview?.type === "audio" && (
        <audio controls className="w-full">
          <source src={preview.url} />
        </audio>
      )}

      {run.error && (
        <p className="mt-3 rounded-md bg-failure/12 px-3 py-2 text-xs text-failure">{run.error}</p>
      )}
    </article>
  );
}
