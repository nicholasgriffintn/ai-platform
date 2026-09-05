import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { RefreshCw } from "lucide-react";

export type RerunPhase = "analyzing" | "summarizing" | "generating" | null;

const PHASE_LABELS: Record<Exclude<RerunPhase, null>, string> = {
  analyzing: " - Analyzing",
  summarizing: " - Summarizing",
  generating: " - Generating Report",
};

export interface RerunReportControlProps {
  isRerunning: boolean;
  isDisabled?: boolean;
  progressPercentage: number;
  phase?: RerunPhase;
  errorMessage?: string | null;
  onRerun: () => void;
  className?: string;
}

export function RerunReportControl({
  isRerunning,
  isDisabled = false,
  progressPercentage,
  phase = null,
  errorMessage,
  onRerun,
  className,
}: RerunReportControlProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Button
        onClick={onRerun}
        disabled={isRerunning || isDisabled}
        variant="secondary"
        className="flex items-center gap-1"
      >
        <RefreshCw size={16} className={cn(isRerunning && "animate-spin")} />
        {isRerunning
          ? `Rerunning (${progressPercentage}%)${phase ? PHASE_LABELS[phase] : ""}`
          : "Rerun Analysis"}
      </Button>

      {errorMessage && (
        <div
          role="alert"
          className="mt-2 p-2 bg-failure/12 border border-failure/45 text-failure text-sm rounded"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
