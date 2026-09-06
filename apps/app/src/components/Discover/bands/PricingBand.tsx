import { ButtonLink, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { useMemo } from "react";

import { usePlans } from "~/hooks/useBilling";
import { formatPlanPrice } from "~/lib/plan-format";

import { DiscoverBand } from "../DiscoverBand";

export function PricingBand() {
  const { data, isLoading } = usePlans();
  const plans = useMemo(() => [...(data ?? [])].sort((a, b) => a.price - b.price), [data]);

  return (
    <DiscoverBand
      id="pricing"
      eyebrow="Plans"
      title="Credits, not message counts"
      lede="Each plan includes a monthly pot of credits. Everything you run draws from it at the vendor's actual rate, and the ledger shows every line."
      actions={
        <ButtonLink variant="outline" href="/pricing">
          See pricing
        </ButtonLink>
      }
    >
      <ul className="grid gap-3 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-28 w-full rounded-xl" />
              </li>
            ))
          : plans.map((plan) => (
              <li
                key={plan.id}
                className="bg-surface border-border flex flex-col gap-1 rounded-xl border p-4"
              >
                <span className="text-foreground text-sm font-medium">{plan.name}</span>
                <span className="font-display text-foreground text-2xl font-medium tracking-tight">
                  {plan.price === 0 ? "Free" : formatPlanPrice(plan.price)}
                  {plan.price > 0 && (
                    <span className="text-muted-foreground font-sans text-xs font-normal">
                      {" "}
                      a month
                    </span>
                  )}
                </span>
                {plan.included_credits !== null && (
                  <span className="text-muted-foreground text-xs">
                    {formatCredits(plan.included_credits)} credits a month
                  </span>
                )}
              </li>
            ))}
      </ul>
    </DiscoverBand>
  );
}
