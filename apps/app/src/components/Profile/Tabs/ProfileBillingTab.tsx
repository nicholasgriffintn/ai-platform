import { BillingPanel } from "@ngriffin_uk/polychat-component-account";
import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { PageShell } from "~/components/Core/PageShell";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
  useCancelSubscription,
  useCreateCheckoutSession,
  useReactivateSubscription,
  useSubscription,
} from "~/hooks/useBilling";
import { isAuthenticationError } from "~/lib/errors";
import { useUIStore } from "~/state/stores/uiStore";

type PageAction = {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

const IS_DISABLED = import.meta.env.VITE_BILLING_DISABLED === "true";

export function ProfileBillingTab() {
  const { trackEvent } = useTrackEvent();

  const { data: sub, isLoading: isSubLoading, error: subError } = useSubscription();

  const { mutate: checkout, status: checkoutStatus } = useCreateCheckoutSession();

  const { mutate: cancelSub, status: cancelStatus } = useCancelSubscription();

  const { mutate: reactivateSub, status: reactivateStatus } = useReactivateSubscription();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  const actions: PageAction[] = [];

  if (!isSubLoading && !subError) {
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
