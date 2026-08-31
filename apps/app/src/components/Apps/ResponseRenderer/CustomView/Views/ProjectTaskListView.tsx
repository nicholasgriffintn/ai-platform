import {
  projectTaskSchema,
  projectTaskStatusLabels,
  type ProjectTask,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

function parseTasks(data: unknown): { tasks: ProjectTask[]; total: number } | null {
  if (!isRecord(data) || !Array.isArray(data.tasks)) {
    return null;
  }

  const tasks = data.tasks.flatMap((task) => {
    const parsed = projectTaskSchema.safeParse(task);

    return parsed.success ? [parsed.data] : [];
  });
  const total = typeof data.total === "number" ? data.total : tasks.length;

  return { tasks, total };
}

export function ProjectTaskListView({ data }: { data: unknown }) {
  const result = parseTasks(data);

  if (!result) {
    return <p className="text-sm text-red-600 dark:text-red-300">Task results are invalid.</p>;
  }

  if (result.tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks match this filter.</p>;
  }

  return (
    <section className="space-y-2" aria-label="Project work queue">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Project work queue</span>
        <span>{result.total} total</span>
      </div>
      <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {result.tasks.map((task) => (
          <li key={task.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-medium leading-5 text-foreground">
                {task.objective}
              </p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {projectTaskStatusLabels[task.status]}
              </span>
            </div>
            {(task.acceptanceCriteria.length > 0 || task.blockedDetail) && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {task.acceptanceCriteria.length > 0 && (
                  <p>
                    {task.acceptanceCriteria.length} acceptance{" "}
                    {task.acceptanceCriteria.length === 1 ? "criterion" : "criteria"}
                  </p>
                )}
                {task.blockedDetail && (
                  <p className="text-amber-700 dark:text-amber-300">{task.blockedDetail}</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
