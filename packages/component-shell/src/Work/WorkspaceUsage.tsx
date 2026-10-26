import { UsageSummaryCard } from "@ngriffin_uk/polychat-component-account";
import { Button, Card, Input } from "@ngriffin_uk/polychat-component-ui";
import {
  useWorkCosts,
  useWorkspaceUsage,
  workspaceProjectUsageRows,
} from "@ngriffin_uk/polychat-library-react";
import {
  creditsFromCreditMicros,
  usagePeriodFromDate,
  usagePeriodSchema,
  type ProjectSummary,
  type WorkSpendRow,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { useId, useState } from "react";

export function WorkspaceUsage({
  workspaceId,
  projects,
}: {
  workspaceId: string;
  projects: ProjectSummary[];
}) {
  const [period, setPeriod] = useState(usagePeriodFromDate);
  const inputId = useId();
  const query = useWorkspaceUsage(workspaceId, period, true);
  const costs = useWorkCosts(workspaceId, period);
  const toRows = (rows: readonly WorkSpendRow[], withCap = false) =>
    rows.map((row) => ({
      key: row.id,
      label:
        withCap && row.capCreditMicros
          ? `${row.name} · cap ${formatCredits(creditsFromCreditMicros(row.capCreditMicros))}`
          : row.name,
      credits: creditsFromCreditMicros(row.creditMicros),
      cost_micros: row.costMicros,
      event_count: row.runCount,
    }));
  const groups = costs.data
    ? [
        { title: "By teammate", rows: toRows(costs.data.teammates, true) },
        { title: "By initiative", rows: toRows(costs.data.initiatives) },
        { title: "Most expensive tasks", rows: toRows(costs.data.tasks.slice(0, 10)) },
      ]
    : [];

  return (
    <section className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Recorded spend for this workspace, including every teammate run. Each person pays from
            their own account. Usage may be delayed or estimated, and provider costs include your
            own keys.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor={inputId} className="block text-xs text-muted-foreground">
              Month (UTC)
            </label>
            <Input
              id={inputId}
              type="month"
              value={period}
              className="h-auto border-border-strong p-2 text-sm"
              onChange={(event) => {
                const result = usagePeriodSchema.safeParse(event.target.value);

                if (result.success) {
                  setPeriod(result.data);
                }
              }}
            />
          </div>
          <Button
            variant="secondary"
            isLoading={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>
      {query.error ? (
        <p role="alert" className="text-sm text-failure">
          {query.error.message}
        </p>
      ) : query.isLoading ? (
        <Card className="p-5">Loading workspace usage…</Card>
      ) : query.data ? (
        <UsageSummaryCard
          summary={query.data}
          projectRows={workspaceProjectUsageRows(query.data, projects)}
          groups={groups}
        />
      ) : null}
    </section>
  );
}
