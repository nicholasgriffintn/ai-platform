import { cn } from "@ngriffin_uk/polychat-component-ui";

export const TASK_VIEWS = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
  { id: "tree", label: "Tree" },
  { id: "timeline", label: "Timeline" },
  { id: "triage", label: "Triage" },
] as const;

export type TaskView = (typeof TASK_VIEWS)[number]["id"];

export function readTaskView(value: string | null): TaskView {
  return TASK_VIEWS.find((view) => view.id === value)?.id ?? "list";
}

export function TaskViewTabs({
  view,
  triageCount,
  onChange,
}: {
  view: TaskView;
  triageCount: number;
  onChange: (view: TaskView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Task views"
      className="flex gap-0.5 rounded-md bg-selection/60 p-0.5"
    >
      {TASK_VIEWS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={view === option.id}
          className={cn(
            "rounded px-3 py-1 text-xs",
            view === option.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.id === "triage" && triageCount > 0 ? ` · ${triageCount}` : ""}
        </button>
      ))}
    </div>
  );
}
