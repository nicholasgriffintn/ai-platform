import {
  submitSandboxRunInstruction,
  updateSandboxRunControl,
} from "@ngriffin_uk/polychat-library-client";
import type {
  SandboxRunControl,
  SandboxRunControlAction,
  SandboxRunInstructionEnvelope,
  SandboxRunInstructionKind,
  SandboxServiceAction,
} from "@ngriffin_uk/polychat-schemas";
import type { ProjectWorkbenchApprovalItem } from "@ngriffin_uk/polychat-utility-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "../errors";

interface InstructionInput {
  kind: SandboxRunInstructionKind;
  idempotencyKey: string;
  content?: string;
  requestId?: string;
  approvalStatus?: "approved" | "rejected";
  serviceName?: string;
  serviceAction?: SandboxServiceAction;
}

export function useProjectWorkbenchControls(params: {
  runId?: string;
  control?: SandboxRunControl;
  instructions: SandboxRunInstructionEnvelope[];
  onChanged: () => Promise<unknown>;
}) {
  const instructionMutation = useMutation({
    mutationFn: async (input: InstructionInput) => {
      if (!params.runId) {
        throw new Error("No coding run is selected");
      }

      return submitSandboxRunInstruction({
        runId: params.runId,
        ...input,
      });
    },
    onSuccess: async () => {
      await params.onChanged();
    },
  });
  const controlMutation = useMutation({
    mutationFn: async (action: SandboxRunControlAction) => {
      if (!params.runId || !params.control) {
        throw new Error("Live run control state is unavailable");
      }

      return updateSandboxRunControl(params.runId, {
        action,
        expectedUpdatedAt: params.control.updatedAt,
      });
    },
    onSuccess: async () => {
      await params.onChanged();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "The run control could not be updated"));
    },
  });
  const submitInstruction = (input: Omit<InstructionInput, "idempotencyKey">) =>
    instructionMutation.mutateAsync({ ...input, idempotencyKey: crypto.randomUUID() });
  const approvals: ProjectWorkbenchApprovalItem[] = params.instructions.flatMap(
    ({ instruction }) =>
      instruction.kind === "approval_request" &&
      (instruction.approvalStatus === "pending" || instruction.approvalStatus === "escalated")
        ? [
            {
              id: instruction.id,
              command: instruction.command,
              state: instruction.approvalStatus,
            },
          ]
        : [],
  );

  return {
    approvals,
    isSubmittingInstruction: instructionMutation.isPending,
    isUpdatingControl: controlMutation.isPending,
    error: instructionMutation.error ?? controlMutation.error,
    addInstruction: async (content: string) => {
      await submitInstruction({ kind: "message", content });
    },
    continueRun: async () => {
      await submitInstruction({ kind: "continue" });
    },
    pauseRun: async () => {
      await controlMutation.mutateAsync("pause");
    },
    resumeRun: async () => {
      await controlMutation.mutateAsync("resume");
    },
    cancelRun: async () => {
      await controlMutation.mutateAsync("cancel");
    },
    resolveApproval: async (requestId: string, approvalStatus: "approved" | "rejected") => {
      await submitInstruction({ kind: "approval_response", requestId, approvalStatus });
    },
    serviceAction: async (serviceName: string, serviceAction: SandboxServiceAction) => {
      await submitInstruction({ kind: "service_action", serviceName, serviceAction });
    },
  };
}
