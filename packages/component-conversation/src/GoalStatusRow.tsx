import { Target } from "lucide-react";

export interface GoalStatusRowProps {
  label: string;
  objective?: string;
}

export function GoalStatusRow({ label, objective }: GoalStatusRowProps) {
  return (
    <output
      aria-label={objective ? `${label}: ${objective}` : label}
      className="flex items-center gap-4 py-3 text-sm font-medium text-muted-foreground"
    >
      <span className="h-px flex-1 bg-border" />
      <span className="flex min-w-0 items-center gap-2">
        <Target className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{objective ? `${label}: ${objective}` : label}</span>
      </span>
      <span className="h-px flex-1 bg-border" />
    </output>
  );
}
