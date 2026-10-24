import { cn } from "../utils";
import type { MediaStatus } from "./media-status";

export function MediaStatusChip({
  status,
  tone = "surface",
  className,
}: {
  status: MediaStatus;
  tone?: "surface" | "overlay";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium whitespace-nowrap tabular-nums",
        tone === "overlay"
          ? "bg-black/50 text-white backdrop-blur"
          : "bg-selection text-muted-foreground",
        status.state === "failed" && (tone === "overlay" ? "text-red-200" : "text-failure"),
        className,
      )}
    >
      {status.state === "making" && (
        <span aria-hidden className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {status.label}
    </span>
  );
}
