import { ScrollText } from "lucide-react";

export interface CompactionStatusRowProps {
  label: string;
  detail?: string | null;
  pending?: boolean;
}

export function CompactionStatusRow({ label, detail, pending = false }: CompactionStatusRowProps) {
  const accessibleLabel = detail ? `${label}. ${detail}` : label;

  return (
    <div
      role="status"
      aria-label={accessibleLabel}
      className="flex items-center gap-4 py-3 text-sm font-medium text-muted-foreground"
    >
      <div className="bg-border h-px flex-1" />
      <div className="flex min-w-0 items-center gap-2">
        {pending ? null : <ScrollText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
        <span className="truncate">
          {label}
          {detail ? <span className="font-normal"> · {detail}</span> : null}
        </span>
      </div>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}
