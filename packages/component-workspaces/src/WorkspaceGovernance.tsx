import { Button, Card, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { ClipboardList, LayoutTemplate, Play, Trash2 } from "lucide-react";

export interface ProjectTemplateSummary {
  id: string;
  name: string;
  description?: string | null;
}

export interface WorkspaceAuditRecordSummary {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  createdAt: string;
}

export interface WorkspaceTemplateListProps {
  templates: ProjectTemplateSummary[];
  isLoading: boolean;
  errorMessage?: string;
  /** Template currently being turned into a project, so only that row shows progress. */
  instantiatingTemplateId?: string | null;
  onUse: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export function WorkspaceTemplateList({
  templates,
  isLoading,
  errorMessage,
  instantiatingTemplateId,
  onUse,
  onDelete,
}: WorkspaceTemplateListProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LayoutTemplate size={18} className="text-zinc-500" /> Project templates
        </h2>
        <p className="text-sm text-zinc-500">Create projects from saved configurations.</p>
      </div>
      {errorMessage ? (
        <EmptyState title="Templates unavailable" message={errorMessage} />
      ) : isLoading ? (
        <Card className="p-6 text-sm text-zinc-500 shadow-none">Loading templates…</Card>
      ) : templates.length === 0 ? (
        <EmptyState
          title="No project templates"
          message="Save a project as a template from its overview."
          className="min-h-[180px]"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium">{template.name}</h3>
                <p className="truncate text-xs text-zinc-500">
                  {template.description || "Reusable project setup"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                icon={<Play size={14} />}
                isLoading={instantiatingTemplateId === template.id}
                onClick={() => onUse(template.id)}
              >
                Use
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={14} />}
                onClick={() => onDelete(template.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
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
          <ClipboardList size={18} className="text-zinc-500" /> Audit history
        </h2>
        <p className="text-sm text-zinc-500">Review governed changes in this workspace.</p>
      </div>
      {errorMessage ? (
        <EmptyState title="Audit history unavailable" message={errorMessage} />
      ) : isLoading ? (
        <Card className="p-6 text-sm text-zinc-500 shadow-none">Loading audit history…</Card>
      ) : records.length === 0 ? (
        <EmptyState
          title="No audit history"
          message="Governed workspace changes will appear here."
          className="min-h-[180px]"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          {records.map((record) => (
            <div
              key={record.id}
              className="border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
            >
              <p className="text-sm font-medium capitalize">{record.action.replaceAll(".", " ")}</p>
              <p className="mt-1 text-xs text-zinc-500">
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
