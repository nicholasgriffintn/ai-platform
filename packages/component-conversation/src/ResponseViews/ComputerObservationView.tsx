import { ImageModal } from "@ngriffin_uk/polychat-component-content";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { Monitor } from "lucide-react";

export interface ComputerObservationData {
  screenshot: string | null;
  title: string;
  width: number;
  height: number;
}

const readObservation = (data: unknown): ComputerObservationData | null => {
  if (!isRecord(data)) {
    return null;
  }

  return {
    screenshot: typeof data.screenshot === "string" && data.screenshot ? data.screenshot : null,
    title: typeof data.title === "string" && data.title ? data.title : "Hosted computer",
    width: typeof data.width === "number" && Number.isFinite(data.width) ? data.width : 1440,
    height: typeof data.height === "number" && Number.isFinite(data.height) ? data.height : 900,
  };
};

export function ComputerObservationView({ data }: { data: unknown }) {
  const observation = readObservation(data);

  if (!observation) {
    return null;
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-surface-elevated">
      <figcaption className="flex min-w-0 items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
        <Monitor size={14} className="shrink-0" aria-hidden="true" />
        <span className="truncate font-medium text-foreground">{observation.title}</span>
        <span className="ml-auto shrink-0 tabular-nums">
          {observation.width} × {observation.height}
        </span>
      </figcaption>
      {observation.screenshot ? (
        <ImageModal
          src={observation.screenshot}
          alt={observation.title}
          thumbnailClassName="block w-full"
          imageClassName="block h-auto w-full object-contain"
          crossOrigin="anonymous"
        />
      ) : (
        <p className="px-3 pb-3 text-xs text-muted-foreground">
          The computer responded but no screenshot was captured.
        </p>
      )}
    </figure>
  );
}
