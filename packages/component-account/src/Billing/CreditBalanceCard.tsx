import { Badge, Card, cn } from "@ngriffin_uk/polychat-component-ui";
import type { UsageBalanceResponse } from "@ngriffin_uk/polychat-schemas";
import {
  formatCredits,
  formatDate,
  getBoundedPercentage,
} from "@ngriffin_uk/polychat-utility-core";

import { SettingsSection } from "../SettingsSection";
import { CREDIT_STATE_DESCRIPTIONS, CREDIT_STATE_LABELS } from "./usage-display";

export interface CreditBalanceCardProps {
  balance: UsageBalanceResponse;
}

const stateBadgeClasses: Record<UsageBalanceResponse["credits"]["state"], string> = {
  ok: "bg-success/12 text-success",
  reserve: "bg-attention/12 text-attention",
  overage: "bg-creative/12 text-creative",
  exhausted: "bg-failure/12 text-failure",
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
  const isMetered = credits.included > 0;

  return (
    <SettingsSection
      title="Credits"
      actions={
        <Badge className={cn("border-transparent", stateBadgeClasses[credits.state])}>
          {CREDIT_STATE_LABELS[credits.state]}
        </Badge>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-foreground">
            {formatCredits(credits.used)}
            <span className="text-lg font-normal text-muted-foreground">
              {" "}
              {isMetered ? `used of ${formatCredits(credits.included)}` : "used"}
            </span>
          </p>
        </div>
      </div>

      <div
        className="bg-selection relative mt-4 h-3 overflow-hidden rounded-full"
        role="meter"
        aria-label={`${formatCredits(credits.used)} of ${formatCredits(credits.included)} included credits used, ${formatCredits(reserveRemaining)} of reserve remaining`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(usedPercentage)}
      >
        <div className="absolute inset-y-0 left-0 flex w-full">
          <div
            className="h-full rounded-full bg-creative transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(usedPercentage, reserveStartPercentage)}%` }}
          />
          {usedPercentage > reserveStartPercentage && (
            <div
              className="h-full rounded-r-full bg-attention/80 transition-[width] duration-500 ease-out motion-safe:animate-pulse"
              style={{ width: `${usedPercentage - reserveStartPercentage}%` }}
            />
          )}
        </div>
        <div
          className="bg-surface absolute inset-y-0 w-0.5"
          style={{ left: `${reserveStartPercentage}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Included</p>
          <p className="text-sm font-medium text-foreground">{formatCredits(credits.included)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="text-sm font-medium text-foreground">{formatCredits(includedRemaining)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {inReserve ? "Reserve remaining" : "Reserve"}
          </p>
          <p className="text-sm font-medium text-foreground">
            {formatCredits(inReserve ? reserveRemaining : credits.grace)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Resets</p>
          <p className="text-sm font-medium text-foreground">{formatDate(balance.resets_at)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {isMetered
          ? CREDIT_STATE_DESCRIPTIONS[credits.state]
          : "This plan has no credit allowance configured yet."}
      </p>

      {credits.overage > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          {formatCredits(credits.overage)} credits of overage so far this period.
        </p>
      )}
    </SettingsSection>
  );
}
