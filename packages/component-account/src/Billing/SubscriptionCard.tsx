import { Button, Switch } from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink } from "lucide-react";

import { SettingsSection } from "../SettingsSection";
import type { Subscription } from "./types";

export interface SubscriptionCardProps {
  subscription: Subscription | null;
  planName: string;
  overageEnabled: boolean;
  showManageBilling: boolean;
  showOverageToggle: boolean;
  isCancelling: boolean;
  isReactivating: boolean;
  isOpeningPortal: boolean;
  isUpdatingOverage: boolean;
  onCancel: () => void;
  onReactivate: () => void;
  onManageBilling: () => void;
  onOverageChange: (enabled: boolean) => void;
  onSeePlans: () => void;
}

function unixToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

export function SubscriptionCard({
  subscription,
  planName,
  overageEnabled,
  showManageBilling,
  showOverageToggle,
  isCancelling,
  isReactivating,
  isOpeningPortal,
  isUpdatingOverage,
  onCancel,
  onReactivate,
  onManageBilling,
  onOverageChange,
  onSeePlans,
}: SubscriptionCardProps) {
  const item = subscription?.items?.data?.[0];
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const cancelPending = Boolean(subscription?.cancel_at_period_end);

  return (
    <SettingsSection title="Subscription">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{planName}</p>
          {item && (
            <p className="text-sm text-muted-foreground">
              {(item.price.unit_amount / 100).toFixed(2)} {subscription?.currency.toUpperCase()} /{" "}
              {item.price.recurring.interval}
              {cancelPending && subscription?.cancel_at
                ? ` · ends ${formatDate(unixToIso(subscription.cancel_at))}`
                : ` · renews ${formatDate(unixToIso(item.current_period_end))}`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showManageBilling && (
            <Button
              variant="outline"
              size="sm"
              isLoading={isOpeningPortal}
              icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
              onClick={onManageBilling}
            >
              Manage billing
            </Button>
          )}
          {isActive &&
            (cancelPending ? (
              <Button
                variant="secondary"
                size="sm"
                isLoading={isReactivating}
                onClick={onReactivate}
              >
                Reactivate
              </Button>
            ) : (
              <Button variant="ghost" size="sm" isLoading={isCancelling} onClick={onCancel}>
                Cancel plan
              </Button>
            ))}
          {!isActive && (
            <Button variant="primary" size="sm" onClick={onSeePlans}>
              See plans
            </Button>
          )}
        </div>
      </div>

      {cancelPending && subscription?.cancel_at && (
        <p className="mt-3 rounded-md bg-attention/12 px-3 py-2 text-sm text-attention">
          Your subscription ends on {formatDate(unixToIso(subscription.cancel_at))}. Reactivate any
          time before then and nothing changes.
        </p>
      )}

      {showOverageToggle && isActive && (
        <div className="mt-4 border-t border-border pt-4">
          <Switch
            id="overage-opt-in"
            label="Pay-as-you-go overage"
            description="Off, new turns pause once your included credits and reserve are spent, until the period resets. On, work carries on past the reserve and each extra credit is billed to your card at the end of the period."
            checked={overageEnabled}
            disabled={isUpdatingOverage}
            onChange={(event) => onOverageChange(event.target.checked)}
          />
        </div>
      )}
    </SettingsSection>
  );
}
