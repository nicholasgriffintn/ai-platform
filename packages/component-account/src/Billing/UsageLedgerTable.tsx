import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  USAGE_SOURCES,
  type UsageEventRecord,
  type UsageSource,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits, formatUsdFromMicros } from "@ngriffin_uk/polychat-utility-core";
import { Loader2 } from "lucide-react";

import { SettingsSection } from "../SettingsSection";
import { describeUsageEvent, formatUsageQuantity, humaniseUsageSource } from "./usage-display";

export interface UsageLedgerTableProps {
  events: UsageEventRecord[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  source: UsageSource | "all";
  onSourceChange: (source: UsageSource | "all") => void;
}

const LEDGER_FILTERS: Array<UsageSource | "all"> = [...USAGE_SOURCES, "all"];

function formatEventDate(occurredAt: string): string {
  const date = new Date(occurredAt);

  if (Number.isNaN(date.getTime())) {
    return occurredAt;
  }

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LedgerCreditsCell({ event }: { event: UsageEventRecord }) {
  if (event.byok) {
    return (
      <div className="text-right">
        <p className="text-foreground">0</p>
        <p className="text-xs text-success">your key · {formatUsdFromMicros(event.cost_micros)}</p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-foreground">{formatCredits(event.credits)}</p>
      <p className="text-xs text-muted-foreground">
        {formatUsdFromMicros(event.cost_micros)}
        {event.estimated ? " · estimated" : ""}
      </p>
    </div>
  );
}

export function UsageLedgerTable({
  events,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  source,
  onSourceChange,
}: UsageLedgerTableProps) {
  return (
    <SettingsSection
      title="Ledger"
      description="Every priced piece of work, line by line. Rows on your own keys show their cost but charge no credits."
    >
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter the ledger">
        {LEDGER_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={source === filter}
            onClick={() => onSourceChange(filter)}
            className={
              source === filter
                ? "bg-human-action text-human-action-foreground rounded-full px-3 py-1 text-xs font-medium"
                : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-border-strong"
            }
          >
            {filter === "all" ? "All" : humaniseUsageSource(filter)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No entries yet. A quiet ledger is nothing to worry about.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">When</th>
                <th className="pb-2 pr-3 font-medium">What</th>
                <th className="pb-2 pr-3 font-medium">Amount</th>
                <th className="pb-2 text-right font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {formatEventDate(event.occurred_at)}
                  </td>
                  <td className="py-2 pr-3">
                    <p className="text-foreground">
                      {describeUsageEvent(event.vendor, event.resource)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {humaniseUsageSource(event.source)}
                    </p>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {formatUsageQuantity(event.quantity, event.unit)}
                  </td>
                  <td className="py-2">
                    <LedgerCreditsCell event={event} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !isLoading && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isLoadingMore ? "Fetching" : "Show more"}
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}
