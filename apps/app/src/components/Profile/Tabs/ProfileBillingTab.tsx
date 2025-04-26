import {
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "~/components/EmptyState";
import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import {
  useCancelSubscription,
  useCreateCheckoutSession,
  useReactivateSubscription,
  useSubscription,
} from "~/hooks/useBilling";
import { formatDate } from "~/lib/dates";

type PageAction = {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export function ProfileBillingTab() {
  const {
    data: sub,
    isLoading: isSubLoading,
    error: subError,
  } = useSubscription();

  const { mutate: checkout, status: checkoutStatus } =
    useCreateCheckoutSession();

  const { mutate: cancelSub, status: cancelStatus } = useCancelSubscription();

  const { mutate: reactivateSub, status: reactivateStatus } =
    useReactivateSubscription();

  const actions: PageAction[] = [];

  if (!isSubLoading && !subError) {
    if (sub?.status === "active" || sub?.status === "trialing") {
      if (sub.cancel_at_period_end) {
        actions.push({
          label:
            reactivateStatus === "pending"
              ? "Reactivating..."
              : "Reactivate Subscription",
          onClick: () => reactivateSub(),
          icon:
            reactivateStatus === "pending" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            ),
          disabled: reactivateStatus === "pending",
          variant: "primary",
        });
        actions.push({
          label: "Cancellation Pending",
          onClick: () => {},
          icon: <Trash2 className="h-4 w-4" />,
          disabled: true,
          variant: "secondary",
        });
      } else {
        actions.push({
          label:
            cancelStatus === "pending" ? "Canceling..." : "Cancel Subscription",
          onClick: () => cancelSub(),
          icon:
            cancelStatus === "pending" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            ),
          disabled: cancelStatus === "pending",
          variant: "secondary",
        });
      }
    } else {
      actions.push({
        label:
          checkoutStatus === "pending" ? "Redirecting..." : "Upgrade to Pro",
        onClick: () =>
          checkout({
            planId: "pro",
            successUrl: window.location.href,
            cancelUrl: window.location.href,
          }),
        icon:
          checkoutStatus === "pending" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          ),
        disabled: checkoutStatus === "pending",
        variant: "primary",
      });
    }
  }

  return (
    <>
      <PageHeader actions={actions}>
        <PageTitle title="Billing" />
      </PageHeader>

      {sub?.cancel_at_period_end && sub.cancel_at && (
        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded mb-4 text-sm text-yellow-800 dark:text-yellow-200">
          Your subscription will cancel on{" "}
          {formatDate(new Date(sub.cancel_at * 1000).toISOString())}.
        </div>
      )}

      {sub?.trial_start && sub.trial_end && (
        <div className="bg-green-100 dark:bg-green-900 p-4 rounded mb-4 text-sm text-green-800 dark:text-green-200">
          You are in a trial until{" "}
          {formatDate(new Date(sub.trial_end * 1000).toISOString())}.
        </div>
      )}

      {isSubLoading ? (
        <EmptyState message="Loading billing information..." />
      ) : subError ? (
        <EmptyState message="Error loading billing data." />
      ) : sub?.items?.data?.[0] ? (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-zinc-500">Status</h3>
              <p className="text-base text-zinc-800 dark:text-zinc-200">
                {sub.status}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-500">
                Current Period
              </h3>
              <p className="text-base text-zinc-800 dark:text-zinc-200">
                {formatDate(
                  new Date(
                    sub.items.data[0].current_period_start * 1000,
                  ).toISOString(),
                )}{" "}
                –{" "}
                {formatDate(
                  new Date(
                    sub.items.data[0].current_period_end * 1000,
                  ).toISOString(),
                )}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-500">Amount</h3>
              <p className="text-base text-zinc-800 dark:text-zinc-200">
                {(sub.items.data[0].price.unit_amount / 100).toFixed(2)}{" "}
                {sub.currency.toUpperCase()}/
                {sub.items.data[0].price.recurring.interval}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-500">
                Next Billing
              </h3>
              <p className="text-base text-zinc-800 dark:text-zinc-200">
                {formatDate(
                  new Date(
                    sub.items.data[0].current_period_end * 1000,
                  ).toISOString(),
                )}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="bg-blue-100 dark:bg-blue-900/60 p-4 rounded-lg mb-6 border border-blue-200 dark:border-blue-800 flex items-start">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                Polychat is in Development
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-200">
                We're offering a generous 90-day free trial during our
                development phase, and all trials will be extended until our v1
                release. Join us early and help shape the future of Polychat!
              </p>
            </div>
          </div>
          <Card className="p-6 sm:p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex flex-col justify-center items-center md:items-start border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-700 pb-6 md:pb-0 md:pr-8">
                <h2 className="text-3xl font-bold mb-2">Upgrade to Pro</h2>
                <div className="text-5xl font-bold mb-4">
                  $8
                  <span className="text-lg font-normal text-zinc-500">
                    /month
                  </span>
                </div>
                <div className="bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full text-sm font-medium text-green-800 dark:text-green-200 mb-6">
                  <Sparkles className="inline-block mr-1 h-4 w-4" />
                  90-Day Free Trial
                </div>

                <Button
                  disabled={checkoutStatus === "pending"}
                  onClick={() =>
                    checkout({
                      planId: "pro",
                      successUrl: window.location.href,
                      cancelUrl: window.location.href,
                    })
                  }
                  variant="primary"
                  className="w-full px-8 py-2 relative overflow-hidden transition-all duration-300 shadow-lg hover:shadow-xl group"
                >
                  <span className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                  <span className="relative flex items-center justify-center">
                    <Zap className="mr-2 h-4 w-4 animate-pulse text-yellow-100" />
                    <span className="relative">
                      {checkoutStatus === "pending"
                        ? "Redirecting..."
                        : "Upgrade to Pro"}
                    </span>
                  </span>
                </Button>
              </div>

              <div className="grid gap-6 pt-6 md:pt-0">
                <div className="flex items-start">
                  <Rocket className="h-6 w-6 text-indigo-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">
                      Access to the best AI Models
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Get access to our full suite of models including Claude,
                      OpenAI, Grok, Gemini, and more!
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Sparkles className="h-6 w-6 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">
                      Generous Message Limits
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Receive 50 standard message credits per day, plus 200
                      premium credits for image gen, and premium model access.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Zap className="h-6 w-6 text-purple-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Priority Support</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Get faster responses and dedicated assistance when you
                      need help.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
