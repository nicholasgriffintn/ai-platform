import { SandboxView as ControlledSandboxView } from "@ngriffin_uk/polychat-component-content";
import { submitSandboxRunInstruction } from "@ngriffin_uk/polychat-library-client";
import { toast } from "sonner";

interface SandboxViewProps {
  type: string;
  data: Record<string, unknown>;
}

export function SandboxView({ type, data }: SandboxViewProps) {
  return (
    <ControlledSandboxView
      type={type}
      data={data}
      onResolveApproval={async ({ runId, approvalId, command, approvalStatus }) => {
        try {
          await submitSandboxRunInstruction({
            runId,
            kind: "approval_response",
            idempotencyKey: crypto.randomUUID(),
            requestId: approvalId,
            command,
            approvalStatus,
          });
          toast.success(approvalStatus === "approved" ? "Command approved" : "Command rejected");
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to resolve command approval",
          );
          throw error;
        }
      }}
    />
  );
}
