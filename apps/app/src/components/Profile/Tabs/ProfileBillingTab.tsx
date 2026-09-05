import {
  CreditBalanceCard,
  humaniseIdentifier,
  SubscriptionCard,
  UsageLedgerTable,
  UsageSummaryCard,
} from "@ngriffin_uk/polychat-component-account";
import { EmptyState, SignInEmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { UsageSource } from "@ngriffin_uk/polychat-schemas";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ProfileTab } from "~/components/Profile/ProfileTabLayout";
import {
  useBillingPortalAvailability,
  useCancelSubscription,
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
import { useUIStore } from "~/state/stores/uiStore";

const IS_DISABLED = import.meta.env.VITE_BILLING_DISABLED === "true";

function CreditBillingView() {
  const navigate = useNavigate();
  const { data: balance } = useUsageBalance();
  const { data: summary } = useUsageSummary();
  const [ledgerSource, setLedgerSource] = useState<UsageSource | "all">("model");
  const events = useUsageEvents({
    source: ledgerSource === "all" ? undefined : ledgerSource,
  });
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
        showOverageToggle={overageAvailable && plan?.overage_available === true}
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
        source={ledgerSource}
        onSourceChange={setLedgerSource}
      />
    </div>
  );
}

function BillingBody() {
  const { error: subError } = useSubscription();
  const { data: balance, isLoading: isBalanceLoading, error: balanceError } = useUsageBalance();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  if (IS_DISABLED) {
    return <EmptyState message="Billing features are currently disabled." />;
  }

  if (isAuthenticationError(subError) || isAuthenticationError(balanceError)) {
    return (
      <SignInEmptyState
        message="Sign in to see your credit balance and billing."
        onSignIn={() => setShowLoginModal(true)}
      />
    );
  }

  if (isBalanceLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!balance) {
    return (
      <EmptyState message="We could not read your credit balance just now. Try again shortly." />
    );
  }

  return <CreditBillingView />;
}

export function ProfileBillingTab() {
  return (
    <ProfileTab title="Billing">
      <BillingBody />
    </ProfileTab>
  );
}
