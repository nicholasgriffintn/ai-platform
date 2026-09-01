import {
  BillingPanel,
  CreditBalanceCard,
  SubscriptionCard,
  UsageLedgerTable,
  UsageSummaryCard,
  humaniseIdentifier,
} from "@ngriffin_uk/polychat-component-account";
import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
  useBillingPortalAvailability,
  useCancelSubscription,
  useCreateCheckoutSession,
  useOpenBillingPortal,
  useOverageAvailability,
  usePlans,
  useReactivateSubscription,
  useSetOverage,
  useSubscription,
} from "~/hooks/useBilling";
import { useUsageBalance, useUsageEvents, useUsageSummary } from "~/hooks/useUsage";
import { isAuthenticationError } from "~/lib/errors";
import { flattenUsageEventPages } from "~/lib/usage-ledger";
import { isCreditsConfigured } from "~/lib/usage-limits";
import { useUIStore } from "~/state/stores/uiStore";

type PageAction = {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

const IS_DISABLED = import.meta.env.VITE_BILLING_DISABLED === "true";

function CreditBillingView() {
  const navigate = useNavigate();
  const { data: balance } = useUsageBalance();
  const { data: summary } = useUsageSummary();
  const events = useUsageEvents();
  const { data: sub } = useSubscription();
  const { data: plans } = usePlans();

  const { mutate: cancelSub, status: cancelStatus } = useCancelSubscription();
  const { mutate: reactivateSub, status: reactivateStatus } = useReactivateSubscription();
  const { mutate: openPortal, status: portalStatus } = useOpenBillingPortal();
  const { mutate: setOverage, status: overageStatus } = useSetOverage();
  const portalAvailable = useBillingPortalAvailability();
  const overageAvailable = useOverageAvailability();

  if (!balance) {
    return null;
  }

  const plan = plans?.find((candidate) => candidate.id === balance.plan_id);
  const planName = plan?.name ?? (balance.plan_id ? humaniseIdentifier(balance.plan_id) : "Free");

  return (
    <div className="space-y-4">
      <CreditBalanceCard balance={balance} />

      <SubscriptionCard
        subscription={sub ?? null}
        planName={planName}
        overageEnabled={balance.credits.overage_enabled}
        showManageBilling={portalAvailable}
        showOverageToggle={overageAvailable}
        isCancelling={cancelStatus === "pending"}
        isReactivating={reactivateStatus === "pending"}
        isOpeningPortal={portalStatus === "pending"}
        isUpdatingOverage={overageStatus === "pending"}
        onCancel={() => cancelSub()}
        onReactivate={() => reactivateSub()}
        onManageBilling={() => openPortal()}
        onOverageChange={(enabled) => setOverage(enabled)}
        onSeePlans={() => void navigate("/pricing")}
      />

      {summary && <UsageSummaryCard summary={summary} />}

      <UsageLedgerTable
        events={flattenUsageEventPages(events.data?.pages)}
        hasMore={events.hasNextPage}
        isLoading={events.isLoading}
        isLoadingMore={events.isFetchingNextPage}
        onLoadMore={() => void events.fetchNextPage()}
      />
    </div>
  );
}

export function ProfileBillingTab() {
  const { trackEvent } = useTrackEvent();

  const { data: sub, isLoading: isSubLoading, error: subError } = useSubscription();
  const { data: balance, isLoading: isBalanceLoading } = useUsageBalance();

  const { mutate: checkout, status: checkoutStatus } = useCreateCheckoutSession();

  const { mutate: cancelSub, status: cancelStatus } = useCancelSubscription();

  const { mutate: reactivateSub, status: reactivateStatus } = useReactivateSubscription();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  const creditsConfigured = isCreditsConfigured(balance?.credits);

  const actions: PageAction[] = [];

  if (!creditsConfigured && !isSubLoading && !subError) {
    if (sub?.status === "active" || sub?.status === "trialing") {
      if (sub.cancel_at_period_end) {
        actions.push({
          label: reactivateStatus === "pending" ? "Reactivating..." : "Reactivate Subscription",
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
          label: cancelStatus === "pending" ? "Canceling..." : "Cancel Subscription",
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
        label: checkoutStatus === "pending" ? "Redirecting..." : "Upgrade to Pro",
        onClick: () => {
          trackEvent({
            name: "upgrade_to_pro",
            category: "billing",
            label: "upgrade_to_pro",
            value: 1,
          });
          checkout({
            planId: "pro",
            successUrl: window.location.href,
            cancelUrl: window.location.href,
          });
        },
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

  if (IS_DISABLED) {
    return (
      <>
        <PageShell.Header title="Billing" />
        <EmptyState message="Billing features are currently disabled." />
      </>
    );
  }

  if (isBalanceLoading) {
    return (
      <>
        <PageShell.Header title="Billing" />
        <div className="flex items-center justify-center py-12 text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      </>
    );
  }

  if (creditsConfigured) {
    return (
      <>
        <PageShell.Header title="Billing" />
        <CreditBillingView />
      </>
    );
  }

  return (
    <>
      <PageShell.Header title="Billing" actions={actions} />

      <BillingPanel
        subscription={sub}
        isLoading={isSubLoading}
        requiresSignIn={isAuthenticationError(subError)}
        hasLoadError={!isAuthenticationError(subError) && !!subError}
        isCheckingOut={checkoutStatus === "pending"}
        onSignIn={() => setShowLoginModal(true)}
        onUpgrade={() => {
          trackEvent({
            name: "upgrade_to_pro",
            category: "billing",
            label: "upgrade_to_pro",
            value: 1,
          });
          checkout({
            planId: "pro",
            successUrl: window.location.href,
            cancelUrl: window.location.href,
          });
        }}
      />
    </>
  );
}
