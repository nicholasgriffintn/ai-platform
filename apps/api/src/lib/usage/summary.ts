import { creditsFromCreditMicros } from "@ngriffin_uk/polychat-schemas";

import type { UsageEventGroupRow } from "~/repositories/UsageEventRepository";

export function toSummaryGroups(rows: UsageEventGroupRow[]) {
  return rows.map((row) => ({
    key: row.key,
    cost_micros: row.cost_micros,
    credit_micros: row.credit_micros,
    credits: creditsFromCreditMicros(row.credit_micros),
    event_count: row.event_count,
  }));
}

export function totalUsageGroups(rows: UsageEventGroupRow[]) {
  return rows.reduce(
    (totals, row) => ({
      cost_micros: totals.cost_micros + row.cost_micros,
      credit_micros: totals.credit_micros + row.credit_micros,
      event_count: totals.event_count + row.event_count,
    }),
    { cost_micros: 0, credit_micros: 0, event_count: 0 },
  );
}
