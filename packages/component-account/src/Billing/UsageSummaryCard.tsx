import { Card } from "@ngriffin_uk/polychat-component-ui";
import type { UsageSummaryResponse } from "@ngriffin_uk/polychat-schemas";
import {
  formatCredits,
  formatUsdFromMicros,
  getBoundedPercentage,
} from "@ngriffin_uk/polychat-utility-core";

import { humaniseIdentifier, humaniseUsageSource } from "./usage-display";

export interface UsageSummaryCardProps {
  summary: UsageSummaryResponse;
}

interface SummaryRow {
  key: string;
  label: string;
  credits: number;
  cost_micros: number;
  event_count: number;
}

function SummaryGroup({
  title,
  rows,
  totalCredits,
}: {
  title: string;
  rows: SummaryRow[];
  totalCredits: number;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-zinc-700 dark:text-zinc-200">{row.label}</span>
              <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                {formatCredits(row.credits)} credits · {formatUsdFromMicros(row.cost_micros)}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-violet-400 transition-[width] duration-500 ease-out dark:bg-violet-500"
                style={{ width: `${getBoundedPercentage(row.credits, totalCredits)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UsageSummaryCard({ summary }: UsageSummaryCardProps) {
  const totalCredits = summary.totals.credits;

  const sourceRows = summary.by_source.map((group) => ({
    ...group,
    label: humaniseUsageSource(group.key),
  }));

  const vendorRows = summary.by_vendor.map((group) => ({
    ...group,
    label: humaniseIdentifier(group.key),
  }));

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Where it went this period
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatCredits(totalCredits)} credits ·{" "}
          {summary.totals.event_count.toLocaleString("en-GB")} events
        </span>
      </div>

      {summary.totals.event_count === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing spent yet this period. The ledger fills in as you work.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <SummaryGroup title="By source" rows={sourceRows} totalCredits={totalCredits} />
          <SummaryGroup title="By vendor" rows={vendorRows} totalCredits={totalCredits} />
        </div>
      )}
    </Card>
  );
}
