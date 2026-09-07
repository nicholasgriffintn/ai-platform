import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { SandboxRunControlState, SandboxRunStatus } from "@ngriffin_uk/polychat-schemas";
import { CirclePause, CirclePlay, OctagonX, StepForward } from "lucide-react";

export interface ProjectWorkbenchRunControlsProps {
  runStatus: SandboxRunStatus;
  controlState: SandboxRunControlState;
  canControl: boolean;
  disabledReason?: string;
  isSubmittingInstruction?: boolean;
  isUpdatingControl?: boolean;
  onContinue: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
}

function runAction(action: () => Promise<void>): void {
  void action().catch(() => undefined);
}

export function ProjectWorkbenchRunControls({
  runStatus,
  controlState,
  canControl,
  disabledReason,
  isSubmittingInstruction = false,
  isUpdatingControl = false,
  onContinue,
  onPause,
  onResume,
  onCancel,
}: ProjectWorkbenchRunControlsProps) {
  const isTerminal =
    runStatus === "completed" || runStatus === "failed" || runStatus === "cancelled";
  const disabled =
    Boolean(disabledReason) ||
    !canControl ||
    isTerminal ||
    isUpdatingControl ||
    isSubmittingInstruction;
  const controlHint =
    disabledReason ??
    (!canControl
      ? "Only the person who started this run can control it."
      : isTerminal
        ? `This run is ${runStatus} and no longer accepts actions.`
        : undefined);

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1">
      {controlState === "paused" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          collapseLabel="xl"
          disabled={disabled}
          aria-label="Resume"
          title={controlHint ?? "Resume this run"}
          onClick={() => runAction(onResume)}
          icon={<CirclePlay className="size-4" />}
        >
          Resume
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          collapseLabel="xl"
          disabled={disabled || controlState !== "running"}
          aria-label="Pause"
          title={
            controlHint ??
            (controlState === "running"
              ? "Pause at the next safe boundary"
              : `Pause is unavailable while the run is ${controlState}`)
          }
          onClick={() => runAction(onPause)}
          icon={<CirclePause className="size-4" />}
        >
          Pause
        </Button>
      )}

      {controlState === "running" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          collapseLabel="xl"
          disabled={disabled}
          aria-label="Continue"
          title={controlHint ?? "Ask the run to keep going and finish with clear validation"}
          onClick={() => runAction(onContinue)}
          icon={<StepForward className="size-4" />}
        >
          Continue
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        collapseLabel="xl"
        disabled={disabled || controlState === "cancelled"}
        aria-label="Cancel"
        title={controlHint ?? "Cancel this run"}
        onClick={() => runAction(onCancel)}
        icon={<OctagonX className="size-4" />}
      >
        Cancel
      </Button>
    </div>
  );
}
