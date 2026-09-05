import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import { AlertTriangle, CheckCircle2, Clock, GitBranch, Terminal } from "lucide-react";
import { useState } from "react";

import { MemoizedMarkdown } from "./markdown";

export interface SandboxViewProps {
  type: string;
  data: Record<string, unknown>;
  onResolveApproval?: (request: SandboxApprovalRequest) => Promise<void>;
}

export interface SandboxApprovalRequest {
  runId: string;
  approvalId: string;
  command?: string;
  approvalStatus: "approved" | "rejected";
}

export function SandboxView({ type, data, onResolveApproval }: SandboxViewProps) {
  if (type === "sandbox_plan") {
    return (
      <div className="border-border bg-surface-elevated space-y-3 rounded-md border p-3">
        <div className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Clock className="text-active-work h-4 w-4" />
          <span>Plan</span>
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <MemoizedMarkdown>{String(data.plan ?? "")}</MemoizedMarkdown>
        </div>
      </div>
    );
  }

  if (type === "sandbox_result") {
    return <SandboxResultView data={data} />;
  }

  if (type === "sandbox_event") {
    return <SandboxEventView data={data} onResolveApproval={onResolveApproval} />;
  }

  return null;
}

function SandboxResultView({ data }: { data: Record<string, unknown> }) {
  const result = asRecord(data.result);
  const diff = typeof result.diff === "string" ? result.diff : "";
  const logs = typeof result.logs === "string" ? result.logs : "";
  const branchName = typeof result.branchName === "string" ? result.branchName : undefined;
  const error =
    typeof result.error === "string"
      ? result.error
      : typeof data.error === "string"
        ? data.error
        : undefined;
  const isFailed = data.status === "failed" || data.status === "cancelled" || Boolean(error);
  const summary = typeof data.summary === "string" ? data.summary : undefined;

  return (
    <div className="border-border bg-surface-elevated space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {isFailed ? (
          <AlertTriangle className="text-failure h-4 w-4" />
        ) : (
          <CheckCircle2 className="text-success h-4 w-4" />
        )}
        <span className="text-foreground text-sm font-medium">Result</span>
        {typeof data.status === "string" && <Badge variant="outline">{data.status}</Badge>}
        {branchName && (
          <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1 text-xs">
            <GitBranch className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{branchName}</span>
          </span>
        )}
      </div>
      {summary && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <MemoizedMarkdown>{summary}</MemoizedMarkdown>
        </div>
      )}
      {error && (
        <div className="border-failure/30 bg-failure/10 text-failure rounded border p-2 text-sm">
          {String(error)}
        </div>
      )}
      {diff.trim() && <CodeBlock label="Diff" language="diff" value={diff} />}
      {logs.trim() && <CodeBlock label="Logs" value={logs} />}
    </div>
  );
}

function SandboxEventView({
  data,
  onResolveApproval,
}: {
  data: Record<string, unknown>;
  onResolveApproval?: (request: SandboxApprovalRequest) => Promise<void>;
}) {
  const [resolutionStatus, setResolutionStatus] = useState<"approved" | "rejected" | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const event = asRecord(data.event);
  const eventType = typeof data.type === "string" ? data.type : "";
  const approvalStatus =
    typeof event.approvalStatus === "string" ? event.approvalStatus : undefined;
  const approvalRequired =
    (eventType === "command_approval_requested" || eventType === "command_approval_escalated") &&
    (!approvalStatus || approvalStatus === "pending" || approvalStatus === "escalated") &&
    !resolutionStatus;
  const output = typeof event.output === "string" ? event.output : "";
  const runId = typeof event.runId === "string" ? event.runId : undefined;
  const approvalId =
    typeof event.approvalId === "string"
      ? event.approvalId
      : typeof event.instructionId === "string"
        ? event.instructionId
        : undefined;
  const command = typeof event.command === "string" ? event.command : undefined;

  const resolveApproval = async (status: "approved" | "rejected") => {
    if (!runId || !approvalId || !onResolveApproval) {
      return;
    }

    setIsResolving(true);
    try {
      await onResolveApproval({ runId, approvalId, command, approvalStatus: status });
      setResolutionStatus(status);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="border-border bg-surface-elevated space-y-2 rounded-md border p-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {approvalRequired ? (
          <AlertTriangle className="text-attention h-4 w-4" />
        ) : (
          <Terminal className="text-active-work h-4 w-4" />
        )}
        <span className="text-foreground min-w-0 truncate font-medium">
          {String(data.description ?? data.type ?? "Sandbox event")}
        </span>
      </div>
      {typeof event.command === "string" && event.command.trim() && (
        <code className="border-border bg-canvas text-foreground block overflow-x-auto rounded border px-2 py-1 text-xs">
          {event.command}
        </code>
      )}
      {typeof event.path === "string" && event.path.trim() && (
        <div className="text-muted-foreground text-xs">{event.path}</div>
      )}
      {output.trim() && <CodeBlock label={String(event.stream ?? "Output")} value={output} />}
      {typeof event.error === "string" && event.error.trim() && (
        <div className="border-failure/30 bg-failure/10 text-failure rounded border p-2 text-xs">
          {event.error}
        </div>
      )}
      {approvalRequired && runId && approvalId && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void resolveApproval("approved")}
            disabled={isResolving}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => void resolveApproval("rejected")}
            disabled={isResolving}
            className="text-failure hover:text-failure/80"
          >
            Reject
          </Button>
        </div>
      )}
      {resolutionStatus && (
        <div className="text-muted-foreground text-xs font-medium">
          Approval {resolutionStatus}.
        </div>
      )}
    </div>
  );
}

function CodeBlock({
  label,
  value,
  language,
}: {
  label: string;
  value: string;
  language?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs font-medium">{label}</div>
      <pre className="border-border bg-canvas text-foreground max-h-96 overflow-auto rounded border p-2 text-xs">
        <code className={language ? `language-${language}` : undefined}>{value}</code>
      </pre>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
