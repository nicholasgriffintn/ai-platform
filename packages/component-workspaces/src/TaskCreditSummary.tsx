import { Badge } from "@ngriffin_uk/polychat-component-ui";
import {
  formatCreditBandRange,
  summariseCreditSpend,
  sumRunCreditMicros,
  type ProjectTaskPlanEvidence,
} from "@ngriffin_uk/polychat-schemas";

export function TaskCreditSummary({ plan }: { plan: ProjectTaskPlanEvidence }) {
  const attempts = plan.stages.flatMap((stage) => stage.attempts);
  const reported = attempts.filter((attempt) => attempt.usage?.consumption.creditMicros != null);

  if (reported.length === 0) {
    return null;
  }

  const { credits, band } = summariseCreditSpend(
    sumRunCreditMicros(reported.map((attempt) => attempt.usage)),
  );
  const isRunning = plan.stages.some((stage) => stage.status === "executing");

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="font-mono text-foreground tabular-nums">
        {credits.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits
      </span>
      <span>{isRunning ? "so far" : "in total"}</span>
      <Badge variant="outline" title={`${band.description} ${formatCreditBandRange(band)}.`}>
        {band.label}
      </Badge>
      {reported.length < attempts.length ? <span>Some attempts have not reported yet.</span> : null}
    </div>
  );
}
