import { Badge, TextLink } from "@ngriffin_uk/polychat-component-ui";
import {
  creditsFromCreditMicros,
  type ProjectTaskPlanEvidence,
  type ProjectTaskStageEvidence,
} from "@ngriffin_uk/polychat-schemas";

const STATUS_LABELS: Record<ProjectTaskStageEvidence["status"], string> = {
  proposed: "Proposed",
  executing: "Executing",
  completed: "Completed",
  failed: "Failed",
  interrupted: "Interrupted",
  abandoned: "Abandoned",
};

function statusVariant(
  status: ProjectTaskStageEvidence["status"],
): "success" | "warning" | "destructive" | "outline" {
  if (status === "completed") {
    return "success";
  }

  if (status === "executing") {
    return "warning";
  }

  if (status === "failed" || status === "interrupted") {
    return "destructive";
  }

  return "outline";
}

export function TaskStageEvidence({
  plan,
  runHref,
  outputHref,
}: {
  plan: ProjectTaskPlanEvidence;
  runHref: (conversationId: string, runId: string) => string;
  outputHref: (outputId: string) => string;
}) {
  return (
    <section className="space-y-3" aria-label="Plan stage evidence">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Plan evidence</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Proposed stages become completed only when an exact run leaves a durable result.
        </p>
      </div>
      <ol className="space-y-3">
        {plan.stages.map((stage) => (
          <li key={stage.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium capitalize">{stage.name}</p>
              <Badge variant={statusVariant(stage.status)}>{STATUS_LABELS[stage.status]}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Stage {stage.flowStageId ?? "task"} · {stage.attempts.length} attempt
              {stage.attempts.length === 1 ? "" : "s"}
            </p>
            {stage.attempts.length > 0 ? (
              <ul className="mt-3 space-y-2 border-t border-border pt-3">
                {stage.attempts.map((attempt) => (
                  <li key={attempt.id} className="text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <TextLink href={runHref(attempt.conversationId, attempt.runId)}>
                        Run {attempt.runId}
                      </TextLink>
                      <span>
                        attempt {attempt.attempt} · {attempt.status}
                      </span>
                      {attempt.provenance.model ? (
                        <span>
                          {attempt.provenance.model.id} via {attempt.provenance.model.provider}
                        </span>
                      ) : (
                        <span>{attempt.provenance.completeness} origin</span>
                      )}
                      {attempt.usage ? (
                        <span>
                          {attempt.usage.consumption.creditMicros === null
                            ? `${attempt.usage.measurement} usage · consumption unknown`
                            : `${creditsFromCreditMicros(attempt.usage.consumption.creditMicros).toLocaleString()} credits consumed`}
                          {` · ${attempt.usage.settlement.status}`}
                        </span>
                      ) : null}
                    </div>
                    {attempt.outputs.length > 0 ? (
                      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {attempt.outputs.map((output) => (
                          <li key={output.id}>
                            <TextLink href={outputHref(output.id)}>{output.title}</TextLink>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {attempt.terminalReason ? (
                      <p className="mt-1 text-failure">{attempt.terminalReason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No execution evidence.</p>
            )}
          </li>
        ))}
      </ol>
      {!plan.resume.supported && plan.resume.reason ? (
        <p className="text-xs text-attention">{plan.resume.reason}</p>
      ) : null}
    </section>
  );
}
