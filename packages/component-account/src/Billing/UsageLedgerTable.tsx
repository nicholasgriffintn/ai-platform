import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import {
  USAGE_SOURCES,
  type UsageEventRecord,
  type UsageSource,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits, formatUsdFromMicros } from "@ngriffin_uk/polychat-utility-core";
import { Loader2 } from "lucide-react";

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
        <p className="text-zinc-800 dark:text-zinc-200">0</p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          your key · {formatUsdFromMicros(event.cost_micros)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-zinc-800 dark:text-zinc-200">{formatCredits(event.credits)}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
    <Card className="p-5">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Ledger</h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Every priced piece of work, line by line. Rows on your own keys show their cost but charge
        no credits.
      </p>

      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Filter the ledger">
        {LEDGER_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={source === filter}
            onClick={() => onSourceChange(filter)}
            className={
              source === filter
                ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
            }
          >
            {filter === "all" ? "All" : humaniseUsageSource(filter)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No entries yet. A quiet ledger is nothing to worry about.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="pb-2 pr-3 font-medium">When</th>
                <th className="pb-2 pr-3 font-medium">What</th>
                <th className="pb-2 pr-3 font-medium">Amount</th>
                <th className="pb-2 text-right font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="py-2 pr-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatEventDate(event.occurred_at)}
                  </td>
                  <td className="py-2 pr-3">
                    <p className="text-zinc-800 dark:text-zinc-200">
                      {describeUsageEvent(event.vendor, event.resource)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {humaniseUsageSource(event.source)}
                    </p>
                  </td>
                  <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
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
    </Card>
  );
}
