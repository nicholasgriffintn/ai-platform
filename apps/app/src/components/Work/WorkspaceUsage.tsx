import { UsageSummaryCard } from "@ngriffin_uk/polychat-component-account";
import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import {
  usagePeriodFromDate,
  usagePeriodSchema,
  type ProjectSummary,
} from "@ngriffin_uk/polychat-schemas";
import { useId, useState } from "react";

import { useWorkspaceUsage } from "~/hooks/useUsage";
import { workspaceProjectUsageRows } from "~/lib/usage-ledger";

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

  return (
    <section className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Workspace usage</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Recorded spend for this workspace. Each person pays from their own account. Usage may be
            delayed or estimated; provider costs include BYOK usage.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor={inputId} className="block text-xs text-muted-foreground">
              Month (UTC)
            </label>
            <input
              id={inputId}
              type="month"
              value={period}
              className="rounded border border-border-strong bg-transparent p-2 text-sm"
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
        />
      ) : null}
    </section>
  );
}
