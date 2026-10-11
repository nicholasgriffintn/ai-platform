import { Badge } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectTask, ProjectTaskRetrospective } from "@ngriffin_uk/polychat-schemas";

type AssumptionOutcome = ProjectTaskRetrospective["assumptions"][number]["outcome"];

const outcomePresentation: Record<
  AssumptionOutcome,
  { label: string; variant: "success" | "destructive" | "secondary" }
> = {
  held: { label: "Held", variant: "success" },
  broke: { label: "Broke", variant: "destructive" },
  unknown: { label: "Unsettled", variant: "secondary" },
};

export function TaskPlanRecord({
  task,
}: {
  task: Pick<ProjectTask, "assumptions" | "killConditions" | "retrospective">;
}) {
  if (task.assumptions.length === 0 && task.killConditions.length === 0) {
    return null;
  }

  const outcomes = new Map(
    (task.retrospective?.assumptions ?? []).map((assumption) => [assumption.id, assumption]),
  );

  return (
    <section className="space-y-3">
      {task.assumptions.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {task.retrospective ? "How the assumptions held up" : "Rests on"}
          </h2>
          <ul className="space-y-2">
            {task.assumptions.map((assumption) => {
              const outcome = outcomes.get(assumption.id);

              return (
                <li key={assumption.id} className="flex items-start gap-2 text-sm">
                  {outcome ? (
                    <Badge variant={outcomePresentation[outcome.outcome].variant}>
                      {outcomePresentation[outcome.outcome].label}
                    </Badge>
                  ) : null}
                  <span>{assumption.statement}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {task.killConditions.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Stop if</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {task.killConditions.map((condition) => (
              <li key={condition.id}>{condition.condition}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
