import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import type { Plan } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { Check, Loader2 } from "lucide-react";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useAuthStatus } from "~/hooks/useAuth";
import { useCreateCheckoutSession, usePlans } from "~/hooks/useBilling";
import { formatPlanPrice } from "~/lib/plan-format";
import { useUIStore } from "~/state/stores/uiStore";

import { CreditLadder } from "./CreditLadder";

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "everyday chat models",
    "your own provider keys, with no credit cost for model usage",
    "conversation history, sources and saved outputs",
  ],
  pro: [
    "every frontier model in the catalogue",
    "image, video, audio and music generation",
    "live voice sessions",
    "sandboxed coding runs and agents",
    "Work: shared workspaces, projects and tasks",
  ],
  enterprise: ["everything in Pro", "a bespoke credit allowance", "priority support"],
};

function planFeatures(planId: string): string[] {
  return PLAN_FEATURES[planId] ?? [];
}

const HOW_IT_WORKS = [
  {
    title: "Credits, not message counts",
    body: "Each plan includes a monthly pot of credits. Everything you run draws from it at the vendor's actual rate, and the ledger on your billing page shows every line.",
  },
  {
    title: "A reserve on paid plans",
    body: "Paid plans carry a small reserve past their ceiling, so a long-running task finishes its thought rather than being cut off mid-sentence. Free and signed-out use stops at the ceiling.",
  },
  {
    title: "Your own keys",
    body: "Model usage on your own provider keys costs no credits — you pay your provider directly. Infrastructure such as sandbox runs still counts.",
  },
  {
    title: "Overage is opt-in",
    body: "Off by default. Leave it off and new turns simply pause until the month resets; switch it on and extra credits are billed at period end.",
  },
];

function comparePlansByPrice(a: Plan, b: Plan): number {
  return (a.price ?? 0) - (b.price ?? 0);
}

function describePlanAllowance(plan: Plan): string[] {
  const lines: string[] = [];

  if (typeof plan.included_credits === "number" && plan.included_credits > 0) {
    lines.push(`${formatCredits(plan.included_credits)} credits every month`);

    if (typeof plan.grace_credits === "number" && plan.grace_credits > 0) {
      lines.push(`plus a ${formatCredits(plan.grace_credits)} credit reserve`);
    }
  }

  lines.push(...planFeatures(plan.id));

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
  const isFreePlan = !plan.price || plan.price <= 0;

  return (
    <Card className="flex flex-col p-6">
      <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-2 text-4xl font-bold text-foreground">
        {plan.price > 0 ? formatPlanPrice(plan.price) : "Free"}
        {plan.price > 0 && (
          <span className="text-base font-normal text-muted-foreground">/month</span>
        )}
      </p>
      {plan.description && <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>}

      <ul className="mt-4 flex-1 space-y-2">
        {describePlanAllowance(plan).map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <Button variant="secondary" fullWidth disabled>
            Your current plan
          </Button>
        ) : isFreePlan ? (
          isSignedIn ? (
            <Button variant="secondary" fullWidth disabled>
              Included with every account
            </Button>
          ) : (
            <Button variant="primary" fullWidth onClick={onSignIn}>
              Sign in to get started
            </Button>
          )
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
        <p className="polychat-eyebrow">Plans</p>
        <h1 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight text-balance md:text-5xl">
          Pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          One pot of credits per month, spent on whatever you actually run. No meters spinning
          behind your back, and nothing cut off mid-thought.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[...(plans ?? [])].sort(comparePlansByPrice).map((plan) => (
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
              <p className="text-sm text-muted-foreground">
                Plans are being arranged on the perch. In the meantime, everything here works on the
                free tier and your own provider keys.
              </p>
            </Card>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
          How credits work
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.title} className="p-5">
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </Card>
          ))}
          <div className="sm:col-span-2">
            <CreditLadder />
          </div>
        </div>
      </section>
    </div>
  );
}
