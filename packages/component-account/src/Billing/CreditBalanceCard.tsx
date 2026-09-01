import { Badge, Card, cn } from "@ngriffin_uk/polychat-component-ui";
import type { UsageBalanceResponse } from "@ngriffin_uk/polychat-schemas";
import {
  formatCredits,
  formatDate,
  getBoundedPercentage,
} from "@ngriffin_uk/polychat-utility-core";

import { CREDIT_STATE_DESCRIPTIONS, CREDIT_STATE_LABELS } from "./usage-display";

export interface CreditBalanceCardProps {
  balance: UsageBalanceResponse;
}

const stateBadgeClasses: Record<UsageBalanceResponse["credits"]["state"], string> = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  reserve: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  overage: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  exhausted: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export function CreditBalanceCard({ balance }: CreditBalanceCardProps) {
  const { credits } = balance;
  const capacity = credits.included + credits.grace;
  const committed = credits.used + credits.reserved;
  const usedPercentage = getBoundedPercentage(committed, capacity);
  const reserveStartPercentage = getBoundedPercentage(credits.included, capacity);
  const inReserve = credits.state !== "ok";
  const reserveRemaining = Math.max(capacity - committed, 0);
  const includedRemaining = Math.max(credits.included - committed, 0);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Credits</h3>
          <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatCredits(credits.used)}
            <span className="text-lg font-normal text-zinc-500 dark:text-zinc-400">
              {" "}
              / {formatCredits(credits.included)} used
            </span>
          </p>
        </div>
        <Badge className={cn("border-transparent", stateBadgeClasses[credits.state])}>
          {CREDIT_STATE_LABELS[credits.state]}
        </Badge>
      </div>

      <div
        className="relative mt-4 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="meter"
        aria-label={`${formatCredits(credits.used)} of ${formatCredits(credits.included)} included credits used, ${formatCredits(reserveRemaining)} of reserve remaining`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(usedPercentage)}
      >
        <div className="absolute inset-y-0 left-0 flex w-full">
          <div
            className="h-full rounded-full bg-violet-500 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(usedPercentage, reserveStartPercentage)}%` }}
          />
          {usedPercentage > reserveStartPercentage && (
            <div
              className="h-full rounded-r-full bg-amber-400/80 transition-[width] duration-500 ease-out motion-safe:animate-pulse dark:bg-amber-500/70"
              style={{ width: `${usedPercentage - reserveStartPercentage}%` }}
            />
          )}
        </div>
        <div
          className="absolute inset-y-0 w-0.5 bg-white dark:bg-zinc-950"
          style={{ left: `${reserveStartPercentage}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Included</p>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {formatCredits(credits.included)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Remaining</p>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {formatCredits(includedRemaining)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {inReserve ? "Reserve remaining" : "Reserve"}
          </p>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {formatCredits(inReserve ? reserveRemaining : credits.grace)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Resets</p>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {formatDate(balance.resets_at)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        {CREDIT_STATE_DESCRIPTIONS[credits.state]}
      </p>

      {credits.overage > 0 && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {formatCredits(credits.overage)} credits of overage so far this period.
        </p>
      )}
    </Card>
  );
}
