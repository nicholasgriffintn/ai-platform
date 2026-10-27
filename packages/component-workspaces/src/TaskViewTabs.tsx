import { SegmentedControl } from "@ngriffin_uk/polychat-component-ui";

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
    <SegmentedControl
      label="Task views"
      value={view}
      options={TASK_VIEWS.map((option) => ({
        ...option,
        count: option.id === "triage" ? triageCount : undefined,
      }))}
      onChange={onChange}
    />
  );
}
