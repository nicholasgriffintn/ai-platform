import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import { formatConnectorLabel, readConnectorApprovalRequest } from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ConnectorApprovalCardProps {
  data: Record<string, unknown>;
  onResolve?: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
}

export function ConnectorApprovalCard({ data, onResolve }: ConnectorApprovalCardProps) {
  const approval = readConnectorApprovalRequest(data);
  const [resolution, setResolution] = useState<{
    approvalId: string;
    state: "approved" | "rejected";
  } | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  if (!approval) {
    return null;
  }

  const expiresAt = approval.expiresAt ? new Date(approval.expiresAt) : undefined;
  const isExpired =
    approval.state === "expired" || (expiresAt ? expiresAt.getTime() <= Date.now() : false);
  const localResolution =
    resolution?.approvalId === approval.approvalId ? resolution.state : undefined;
  const displayState =
    approval.state !== "pending"
      ? approval.state
      : isExpired
        ? "expired"
        : (localResolution ?? "pending");
  const isResolved = displayState !== "pending";
  const argumentSummary =
    data.argumentSummary && typeof data.argumentSummary === "object"
      ? JSON.stringify(data.argumentSummary, null, 2)
      : undefined;
  const resolve = async (nextResolution: "approved" | "rejected") => {
    if (!onResolve || isExpired) {
      return;
    }

    setIsResolving(true);
    try {
      await onResolve(approval.approvalId, nextResolution);
      setResolution({ approvalId: approval.approvalId, state: nextResolution });
      toast.success(nextResolution === "approved" ? "Action approved" : "Action rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve connector approval");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <section
      className="space-y-3 rounded-lg border border-attention/45 bg-attention/12 p-3 text-sm"
      aria-label="Connector action approval"
    >
      <div className="flex items-start gap-2">
        {displayState === "approved" || displayState === "consumed" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        ) : displayState === "rejected" ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-failure" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Approve external action</span>
            <Badge variant="outline">{formatConnectorLabel(approval.provider)}</Badge>
          </div>
          <p className="text-foreground">
            This will run <code className="font-mono text-xs">{approval.operation}</code> using the
            account selected for this connector.
          </p>
          {expiresAt && !Number.isNaN(expiresAt.getTime()) && !isExpired ? (
            <p className="text-xs text-muted-foreground">Expires {expiresAt.toLocaleString()}.</p>
          ) : null}
        </div>
      </div>
      {argumentSummary ? (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Action details</div>
          <pre className="border-attention/35 bg-surface text-foreground max-h-48 overflow-auto rounded border p-2 text-xs">
            <code>{argumentSummary}</code>
          </pre>
        </div>
      ) : null}

      {isResolved ? (
        <p role="status" className="text-xs font-medium text-muted-foreground">
          {displayState === "consumed"
            ? "Action completed."
            : displayState === "expired"
              ? "This approval has expired."
              : `Action ${displayState}.`}
        </p>
      ) : onResolve && !isExpired ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="primary"
            disabled={isResolving}
            onClick={() => void resolve("approved")}
          >
            Approve and continue
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={isResolving}
            className="text-failure hover:text-failure"
            onClick={() => void resolve("rejected")}
          >
            Reject
          </Button>
        </div>
      ) : null}
    </section>
  );
}
