import { ScrollText } from "lucide-react";

export interface CompactionStatusRowProps {
  label: string;
  detail?: string | null;
  pending?: boolean;
}

export function CompactionStatusRow({ label, detail, pending = false }: CompactionStatusRowProps) {
  const accessibleLabel = detail ? `${label}. ${detail}` : label;

  return (
    <output
      aria-label={accessibleLabel}
      className="flex items-center gap-4 py-3 text-sm font-medium text-muted-foreground"
    >
      <span className="h-px flex-1 bg-border" />
      <span className="flex min-w-0 items-center gap-2">
        {pending ? null : <ScrollText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
        <span className="truncate">
          {label}
          {detail ? <span className="font-normal"> · {detail}</span> : null}
        </span>
      </span>
      <span className="h-px flex-1 bg-border" />
    </output>
  );
}
