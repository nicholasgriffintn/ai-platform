import type {
  ProjectWorkbenchApprovalItem,
  ProjectWorkbenchInstructionItem,
} from "@ngriffin_uk/polychat-component-workspaces";
import type {
  SandboxRunControl,
  SandboxRunControlAction,
  SandboxRunEvent,
  SandboxRunInstruction,
  SandboxRunInstructionEnvelope,
  SandboxRunInstructionKind,
  SandboxServiceAction,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation } from "@tanstack/react-query";

import { submitSandboxRunInstruction, updateSandboxRunControl } from "~/lib/api/sandbox";

interface InstructionInput {
  kind: SandboxRunInstructionKind;
  idempotencyKey: string;
  content?: string;
  requestId?: string;
  approvalStatus?: "approved" | "rejected";
  serviceName?: string;
  serviceAction?: SandboxServiceAction;
}

function wasInstructionProcessed(
  instruction: SandboxRunInstruction,
  events: SandboxRunEvent[],
): boolean {
  if (instruction.kind === "approval_response") {
    return events.some(
      (event) =>
        (event.type === "command_approval_resolved" ||
          event.type === "command_approval_timed_out") &&
        event.approvalId === instruction.requestId,
    );
  }

  if (instruction.kind === "service_action") {
    return events.some(
      (event) =>
        (event.type === "service_action_completed" || event.type === "service_action_rejected") &&
        event.instructionId === instruction.id,
    );
  }

  return events.some(
    (event) => event.type === "run_instruction_received" && event.instructionId === instruction.id,
  );
}

export function useProjectWorkbenchControls(params: {
  runId?: string;
  control?: SandboxRunControl;
  instructions: SandboxRunInstructionEnvelope[];
  events: SandboxRunEvent[];
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
  });
  const submitInstruction = (input: Omit<InstructionInput, "idempotencyKey">) =>
    instructionMutation.mutateAsync({ ...input, idempotencyKey: crypto.randomUUID() });
  const instructionItems: ProjectWorkbenchInstructionItem[] = params.instructions
    .map(({ instruction }) => instruction)
    .filter((instruction) => instruction.kind !== "approval_request")
    .map((instruction) => ({
      id: instruction.id,
      kind: instruction.kind,
      content: instruction.content,
      serviceName: instruction.serviceName,
      serviceAction: instruction.serviceAction,
      state: wasInstructionProcessed(instruction, params.events) ? "processed" : "queued",
    }));
  const accepted = instructionMutation.data;

  if (accepted && !instructionItems.some((item) => item.id === accepted.id)) {
    instructionItems.unshift({
      id: accepted.id,
      kind: accepted.kind,
      content: accepted.content,
      serviceName: accepted.serviceName,
      serviceAction: accepted.serviceAction,
      state: "accepted",
    });
  }

  if (instructionMutation.isPending && instructionMutation.variables) {
    instructionItems.unshift({
      id: `submitted:${instructionMutation.variables.idempotencyKey}`,
      kind: instructionMutation.variables.kind,
      content: instructionMutation.variables.content,
      serviceName: instructionMutation.variables.serviceName,
      serviceAction: instructionMutation.variables.serviceAction,
      state: "submitted",
    });
  }

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
    instructions: instructionItems,
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
