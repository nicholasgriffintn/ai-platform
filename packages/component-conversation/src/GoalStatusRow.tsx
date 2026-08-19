import { Target } from "lucide-react";

export interface GoalStatusRowProps {
  label: string;
  objective?: string;
}

export function GoalStatusRow({ label, objective }: GoalStatusRowProps) {
  return (
    <div
      role="status"
      aria-label={objective ? `${label}: ${objective}` : label}
      className="flex items-center gap-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400"
    >
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      <div className="flex min-w-0 items-center gap-2">
        <Target className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{objective ? `${label}: ${objective}` : label}</span>
      </div>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}
