import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import type { Plan } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { Check, Loader2 } from "lucide-react";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useAuthStatus } from "~/hooks/useAuth";
import { useCreateCheckoutSession, usePlans } from "~/hooks/useBilling";
import { useUIStore } from "~/state/stores/uiStore";

const CREDIT_EXAMPLES = [
  "a quick question ≈ 0.1 credits",
  "a couple of hours of sandboxed coding ≈ 6 credits",
  "a long agent task ≈ 200 credits",
];

const HOW_IT_WORKS = [
  {
    title: "Credits, not message counts",
    body: "Each plan includes a monthly pot of credits. Everything you run draws from it at the vendor's actual rate, and the ledger on your billing page shows every line.",
  },
  {
    title: "A reserve, not a cliff",
    body: "Every plan carries a small reserve past its ceiling, so a long-running task finishes its thought rather than being cut off mid-sentence.",
  },
  {
    title: "Your own keys",
    body: "Model usage on your own provider keys costs no credits — you pay your provider directly. Infrastructure such as sandbox runs still counts.",
  },
  {
    title: "Overage is opt-in",
    body: "Off by default. Leave it off and spending simply pauses at the end of the reserve until the month resets; switch it on and extra credits are billed at period end.",
  },
];

function describePlanAllowance(plan: Plan): string[] {
  const lines: string[] = [];

  if (typeof plan.included_credits === "number" && plan.included_credits > 0) {
    lines.push(`${formatCredits(plan.included_credits)} credits every month`);

    if (typeof plan.grace_credits === "number" && plan.grace_credits > 0) {
      lines.push(`plus a ${formatCredits(plan.grace_credits)} credit reserve`);
    }
  }

  lines.push("model usage on your own provider keys costs no credits");
  lines.push(...CREDIT_EXAMPLES);

  return lines;
}

function PlanCard({
  plan,
  isCurrent,
  isSignedIn,
  isCheckingOut,
  onCheckout,
  onSignIn,
}: {
  plan: Plan;
  isCurrent: boolean;
  isSignedIn: boolean;
  isCheckingOut: boolean;
  onCheckout: (planId: string) => void;
  onSignIn: () => void;
}) {
  return (
    <Card className="flex flex-col p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
      <p className="mt-2 text-4xl font-bold text-zinc-900 dark:text-zinc-100">
        ${plan.price}
        <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">/month</span>
      </p>
      {plan.description && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{plan.description}</p>
      )}

      <ul className="mt-4 flex-1 space-y-2">
        {describePlanAllowance(plan).map((line) => (
          <li
            key={line}
            className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <Button variant="secondary" fullWidth disabled>
            Your current plan
          </Button>
        ) : isSignedIn ? (
          <Button
            variant="primary"
            fullWidth
            isLoading={isCheckingOut}
            onClick={() => onCheckout(plan.id)}
          >
            {isCheckingOut ? "Redirecting" : `Get ${plan.name}`}
          </Button>
        ) : (
          <Button variant="primary" fullWidth onClick={onSignIn}>
            Sign in to get started
          </Button>
        )}
      </div>
    </Card>
  );
}

export function PricingPage() {
  const { trackEvent } = useTrackEvent();
  const { user, isAuthenticated } = useAuthStatus();
  const { data: plans, isLoading } = usePlans();
  const { mutate: checkout, status: checkoutStatus } = useCreateCheckoutSession();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  const handleCheckout = (planId: string) => {
    trackEvent({
      name: "pricing_checkout",
      category: "billing",
      label: planId,
      value: 1,
    });
    checkout({
      planId,
      successUrl: `${window.location.origin}/profile?tab=billing`,
      cancelUrl: window.location.href,
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Pricing</h1>
        <p className="mx-auto mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
          One pot of credits per month, spent on whatever you actually run. No meters spinning
          behind your back, and nothing cut off mid-thought.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(plans ?? []).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={isAuthenticated && user?.plan_id === plan.id}
              isSignedIn={isAuthenticated}
              isCheckingOut={checkoutStatus === "pending"}
              onCheckout={handleCheckout}
              onSignIn={() => setShowLoginModal(true)}
            />
          ))}
          {(plans ?? []).length === 0 && (
            <Card className="p-6 sm:col-span-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Plans are being arranged on the perch. In the meantime, everything here works on the
                free tier and your own provider keys.
              </p>
            </Card>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">How credits work</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.title} className="p-5">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
