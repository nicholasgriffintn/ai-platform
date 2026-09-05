import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  SandboxRunControlState,
  SandboxRunInstructionKind,
  SandboxRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import { CirclePause, CirclePlay, MessageSquarePlus, OctagonX } from "lucide-react";
import { useState } from "react";

export type ProjectWorkbenchInstructionState = "accepted" | "processed" | "queued" | "submitted";

export interface ProjectWorkbenchInstructionItem {
  id: string;
  kind: SandboxRunInstructionKind;
  content?: string;
  serviceName?: string;
  serviceAction?: "start" | "restart" | "stop";
  state: ProjectWorkbenchInstructionState;
}

export interface ProjectWorkbenchApprovalItem {
  id: string;
  command?: string;
  state: "escalated" | "pending";
}

export interface ProjectWorkbenchRunControlsProps {
  runStatus: SandboxRunStatus;
  controlState: SandboxRunControlState;
  canControl: boolean;
  instructions: ProjectWorkbenchInstructionItem[];
  approvals: ProjectWorkbenchApprovalItem[];
  disabledReason?: string;
  isSubmittingInstruction?: boolean;
  isUpdatingControl?: boolean;
  errorMessage?: string;
  onAddInstruction: (content: string) => Promise<void>;
  onContinue: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  onResolveApproval: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
}

function instructionLabel(kind: SandboxRunInstructionKind): string {
  if (kind === "continue") {
    return "Continue";
  }

  if (kind === "approval_response") {
    return "Approval response";
  }

  if (kind === "approval_request") {
    return "Approval request";
  }

  if (kind === "service_action") {
    return "Service action";
  }

  return "Instruction";
}

function runAction(action: () => Promise<void>): void {
  void action().catch(() => undefined);
}

export function ProjectWorkbenchRunControls({
  runStatus,
  controlState,
  canControl,
  instructions,
  approvals,
  disabledReason,
  isSubmittingInstruction = false,
  isUpdatingControl = false,
  errorMessage,
  onAddInstruction,
  onContinue,
  onPause,
  onResume,
  onCancel,
  onResolveApproval,
}: ProjectWorkbenchRunControlsProps) {
  const [instruction, setInstruction] = useState("");
  const [isOpen, setIsOpen] = useState(false);
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
      ? "Only the person who started this run can steer or control it."
      : isTerminal
        ? `This run is ${runStatus} and no longer accepts actions.`
        : undefined);
  const submitInstruction = async () => {
    const value = instruction.trim();

    if (!value) {
      return;
    }

    await onAddInstruction(value);
    setInstruction("");
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      {controlState === "paused" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          collapseLabel="xl"
          disabled={disabled}
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            collapseLabel="xl"
            disabled={disabled}
            title={controlHint ?? "Steer this run"}
            icon={<MessageSquarePlus className="size-4" />}
          >
            Steer
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[min(42rem,90dvh)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Steer this run</DialogTitle>
            <DialogDescription>
              Add an instruction to this coding run. It will be processed at a safe boundary.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Add a focused instruction"
              aria-label="Run instruction"
              maxLength={2000}
              rows={4}
              disabled={disabled}
            />

            {isSubmittingInstruction ? (
              <p className="text-active-work text-sm">Instruction submitted…</p>
            ) : null}
            {errorMessage ? <p className="text-failure text-sm">{errorMessage}</p> : null}

            {approvals.length > 0 ? (
              <section className="space-y-2" aria-label="Pending command approvals">
                <h3 className="text-sm font-medium">Needs approval</h3>
                {approvals.map((approval) => (
                  <div key={approval.id} className="bg-attention/10 rounded-lg p-3">
                    <p className="font-mono text-xs break-words whitespace-pre-wrap">
                      {approval.command ?? "Command details unavailable"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs capitalize">
                      {approval.state}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled}
                        onClick={() => runAction(() => onResolveApproval(approval.id, "approved"))}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => runAction(() => onResolveApproval(approval.id, "rejected"))}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {instructions.length > 0 ? (
              <section className="space-y-2" aria-label="Run instruction queue">
                <h3 className="text-sm font-medium">Instruction history</h3>
                <ul className="space-y-1">
                  {instructions.map((item) => (
                    <li key={item.id} className="bg-surface-elevated rounded-md p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{instructionLabel(item.kind)}</span>
                        <Badge variant="outline" className="ml-auto capitalize">
                          {item.state}
                        </Badge>
                      </div>
                      {item.content ? (
                        <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                          {item.content}
                        </p>
                      ) : null}
                      {item.serviceName && item.serviceAction ? (
                        <p className="text-muted-foreground mt-1">
                          {item.serviceAction} {item.serviceName}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || controlState !== "running"}
              title={
                controlHint ??
                (controlState === "running"
                  ? "Ask the run to continue"
                  : `Continue is unavailable while the run is ${controlState}`)
              }
              onClick={() => runAction(onContinue)}
            >
              Continue
            </Button>
            <Button
              type="button"
              disabled={disabled || !instruction.trim()}
              onClick={() => runAction(submitInstruction)}
            >
              Add instruction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        collapseLabel="xl"
        disabled={disabled || controlState === "cancelled"}
        title={controlHint ?? "Cancel this run"}
        onClick={() => runAction(onCancel)}
        icon={<OctagonX className="size-4" />}
      >
        Cancel
      </Button>
    </div>
  );
}
