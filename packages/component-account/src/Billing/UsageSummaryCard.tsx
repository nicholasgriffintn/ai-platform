import type { UsageSummaryResponse } from "@ngriffin_uk/polychat-schemas";
import {
  formatCredits,
  formatUsdFromMicros,
  getBoundedPercentage,
} from "@ngriffin_uk/polychat-utility-core";

import { SettingsSection } from "../SettingsSection";
import { humaniseIdentifier, humaniseUsageSource } from "./usage-display";

export interface UsageSummaryCardProps {
  summary: UsageSummaryResponse;
  projectRows?: SummaryRow[];
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
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h2>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-foreground">{row.label}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatCredits(row.credits)} credits · {formatUsdFromMicros(row.cost_micros)}
              </span>
            </div>
            <div className="bg-selection mt-1 h-1 rounded-full">
              <div
                className="h-full rounded-full bg-creative transition-[width] duration-500 ease-out"
                style={{ width: `${getBoundedPercentage(row.credits, totalCredits)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UsageSummaryCard({ summary, projectRows }: UsageSummaryCardProps) {
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
    <SettingsSection
      title="Where it went this period"
      actions={
        <span className="text-sm text-muted-foreground">
          {formatCredits(totalCredits)} credits ·{" "}
          {summary.totals.event_count.toLocaleString("en-GB")} events
        </span>
      }
    >
      {summary.totals.event_count === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing spent yet this period. The ledger fills in as you work.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <SummaryGroup title="By source" rows={sourceRows} totalCredits={totalCredits} />
          <SummaryGroup title="By vendor" rows={vendorRows} totalCredits={totalCredits} />
          {projectRows && (
            <SummaryGroup title="By project" rows={projectRows} totalCredits={totalCredits} />
          )}
        </div>
      )}
    </SettingsSection>
  );
}
