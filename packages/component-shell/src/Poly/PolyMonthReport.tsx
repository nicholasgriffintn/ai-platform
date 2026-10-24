import { useGovernanceReport } from "@ngriffin_uk/polychat-library-react";
import { usagePeriodFromDate } from "@ngriffin_uk/polychat-schemas";

import {
  describeMonthApprovals,
  describeMonthRuns,
  describeMonthSpend,
} from "./month-report-copy.js";

export function PolyMonthReport() {
  const { data: report, error, isLoading } = useGovernanceReport(usagePeriodFromDate());

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Tallying the month…</p>;
  }

  if (error || !report) {
    return (
      <p role="alert" className="text-sm text-failure">
        This month's report could not be loaded.
      </p>
    );
  }

  return (
    <section aria-label="This month" className="space-y-1 text-sm">
      <h4 className="font-medium text-foreground">This month</h4>
      <p className="text-muted-foreground">{describeMonthRuns(report.runs)}</p>
      <p className="text-muted-foreground">{describeMonthApprovals(report.approvals)}</p>
      <p className="text-muted-foreground">{describeMonthSpend(report.spend)}</p>
    </section>
  );
}
