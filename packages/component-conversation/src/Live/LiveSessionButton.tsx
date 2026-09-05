import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { RealtimeLiveStatus } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { Loader2, RadioTower, Square } from "lucide-react";

export interface LiveSessionButtonProps {
  status: RealtimeLiveStatus;
  onStart: () => void;
  onStop: () => void;
  fill?: boolean;
}

export function LiveSessionButton({
  status,
  onStart,
  onStop,
  fill = false,
}: LiveSessionButtonProps) {
  const isActive = status === "active";
  const isConnecting = status === "connecting";

  return (
    <Button
      size="sm"
      disabled={isConnecting}
      onClick={isActive ? onStop : onStart}
      className={cn(fill && "flex-1", isActive && "bg-failure/12 text-failure hover:bg-failure/20")}
    >
      {isConnecting ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : isActive ? (
        <Square className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <RadioTower className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{isActive ? "Stop live session" : "Start live session"}</span>
    </Button>
  );
}

export interface LiveSessionDetailProps {
  detail?: string;
}

export function LiveSessionDetail({ detail }: LiveSessionDetailProps) {
  return (
    <div className="min-w-0">
      <div className="min-h-5 truncate px-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
