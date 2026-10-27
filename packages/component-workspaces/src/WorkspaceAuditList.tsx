import { Card, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { ClipboardList } from "lucide-react";

export interface WorkspaceAuditRecordSummary {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  createdAt: string;
}

export interface WorkspaceAuditListProps {
  records: WorkspaceAuditRecordSummary[];
  isLoading: boolean;
  errorMessage?: string;
}

export function WorkspaceAuditList({ records, isLoading, errorMessage }: WorkspaceAuditListProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardList size={18} className="text-muted-foreground" /> Audit history
        </h2>
        <p className="text-sm text-muted-foreground">Review governed changes in this workspace.</p>
      </div>
      {errorMessage ? (
        <EmptyState title="Audit history unavailable" message={errorMessage} />
      ) : isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground shadow-none">
          Loading audit history…
        </Card>
      ) : records.length === 0 ? (
        <EmptyState
          title="No audit history"
          message="Governed workspace changes will appear here."
          className="min-h-[180px]"
        />
      ) : (
        <Card className="max-h-[560px] gap-0 overflow-auto py-0 shadow-none">
          {records.map((record) => (
            <div key={record.id} className="border-b border-border px-5 py-4 last:border-0">
              <p className="text-sm font-medium capitalize">{record.action.replaceAll(".", " ")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="capitalize">{record.targetType}</span>
                {record.targetId ? ` · ${record.targetId}` : ""} · {formatDate(record.createdAt)}
              </p>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
