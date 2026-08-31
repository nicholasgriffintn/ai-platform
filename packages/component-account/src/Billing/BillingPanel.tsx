import { Button, Card, EmptyState, SignInEmptyState } from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Rocket, Sparkles, Zap } from "lucide-react";

export interface SubscriptionItemPrice {
  unit_amount: number;
  recurring: { interval: string };
}

export interface SubscriptionItem {
  current_period_start: number;
  current_period_end: number;
  price: SubscriptionItemPrice;
}

export interface Subscription {
  status?: string;
  currency: string;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  trial_start?: number | null;
  trial_end?: number | null;
  items?: { data?: SubscriptionItem[] };
}

export interface BillingPanelProps {
  subscription?: Subscription | null;
  isLoading?: boolean;
  requiresSignIn?: boolean;
  hasLoadError?: boolean;
  isCheckingOut?: boolean;
  onUpgrade: () => void;
  onSignIn: () => void;
}

const PRO_FEATURES = [
  {
    icon: <Rocket className="h-6 w-6 text-indigo-500 mr-3 mt-0.5 flex-shrink-0" />,
    title: "Access to the best AI Models",
    body: "Get access to our full suite of models including Claude, OpenAI, Grok, Gemini, and more!",
  },
  {
    icon: <Sparkles className="h-6 w-6 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />,
    title: "Generous Message Limits",
    body: "Receive 50 standard message credits per day, plus 200 premium credits for image gen, and premium model access.",
  },
  {
    icon: <Zap className="h-6 w-6 text-purple-500 mr-3 mt-0.5 flex-shrink-0" />,
    title: "Priority Support",
    body: "Get faster responses and dedicated assistance when you need help.",
  },
];

function unixToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function UpgradeOffer({
  isCheckingOut,
  onUpgrade,
}: {
  isCheckingOut: boolean;
  onUpgrade: () => void;
}) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="flex flex-col justify-center items-center md:items-start border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-700 pb-6 md:pb-0 md:pr-8">
          <h2 className="text-3xl font-bold mb-2">Upgrade to Pro</h2>
          <div className="text-5xl font-bold mb-4">
            £8
            <span className="text-lg font-normal text-zinc-500">/month</span>
          </div>

          <Button
            disabled={isCheckingOut}
            onClick={onUpgrade}
            variant="primary"
            className="w-full px-10 py-3 text-lg relative overflow-hidden transition-all duration-300 shadow-lg hover:shadow-xl hover:bg-blue-700"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-gleam" />
            <span className="relative flex items-center justify-center">
              <Zap className="mr-2 h-4 w-4 animate-pulse text-yellow-100" />
              <span className="relative">
                {isCheckingOut ? "Redirecting..." : "Upgrade to Pro"}
              </span>
            </span>
          </Button>
        </div>

        <div className="grid gap-6 pt-6 md:pt-0">
          {PRO_FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-start">
              {feature.icon}
              <div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function SubscriptionSummary({ subscription }: { subscription: Subscription }) {
  const item = subscription.items?.data?.[0];

  if (!item) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-zinc-500">Status</h3>
          <p className="text-base text-zinc-800 dark:text-zinc-200">{subscription.status}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-500">Current Period</h3>
          <p className="text-base text-zinc-800 dark:text-zinc-200">
            {formatDate(unixToIso(item.current_period_start))} –{" "}
            {formatDate(unixToIso(item.current_period_end))}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-500">Amount</h3>
          <p className="text-base text-zinc-800 dark:text-zinc-200">
            {(item.price.unit_amount / 100).toFixed(2)} {subscription.currency.toUpperCase()}/
            {item.price.recurring.interval}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-500">Next Billing</h3>
          <p className="text-base text-zinc-800 dark:text-zinc-200">
            {formatDate(unixToIso(item.current_period_end))}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function BillingPanel({
  subscription,
  isLoading = false,
  requiresSignIn = false,
  hasLoadError = false,
  isCheckingOut = false,
  onUpgrade,
  onSignIn,
}: BillingPanelProps) {
  return (
    <>
      {subscription?.cancel_at_period_end && subscription.cancel_at && (
        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded mb-4 text-sm text-yellow-800 dark:text-yellow-200">
          Your subscription will cancel on {formatDate(unixToIso(subscription.cancel_at))}.
        </div>
      )}

      {subscription?.trial_start && subscription.trial_end && (
        <div className="bg-green-100 dark:bg-green-900 p-4 rounded mb-4 text-sm text-green-800 dark:text-green-200">
          You are in a trial until {formatDate(unixToIso(subscription.trial_end))}.
        </div>
      )}

      {isLoading ? (
        <EmptyState message="Loading billing information..." />
      ) : requiresSignIn ? (
        <SignInEmptyState
          title="Sign in to view billing"
          message="Sign in to manage your subscription and billing details."
          onSignIn={onSignIn}
        />
      ) : hasLoadError ? (
        <EmptyState message="Error loading billing data." />
      ) : subscription?.items?.data?.[0] ? (
        <SubscriptionSummary subscription={subscription} />
      ) : (
        <UpgradeOffer isCheckingOut={isCheckingOut} onUpgrade={onUpgrade} />
      )}
    </>
  );
}
