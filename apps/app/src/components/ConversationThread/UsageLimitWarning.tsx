import { Link } from "react-router";

import { useChatStore } from "~/state/stores/chatStore";
import { useUsageStore } from "~/state/stores/usageStore";

const WARNING_THRESHOLD = 0.2;

export const UsageLimitWarning = () => {
  const { usageLimits } = useUsageStore();
  const { isPro } = useChatStore();

  if (!usageLimits) {
    return null;
  }

  const { daily, pro } = usageLimits;

  const dailyRemaining = daily.limit - daily.used;
  const dailyPercentRemaining = dailyRemaining / daily.limit;

  if (isPro && pro) {
    const proRemaining = pro.limit - pro.used;
    const proPercentRemaining = proRemaining / pro.limit;

    if (proPercentRemaining <= WARNING_THRESHOLD && proRemaining > 0) {
      return (
        <div className="rounded-md bg-amber-100 border border-amber-300 text-amber-800 p-3 mb-4 text-center dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200">
          You only have {proRemaining} Pro messages left today.
        </div>
      );
    }

    if (dailyPercentRemaining <= WARNING_THRESHOLD && dailyRemaining > 0) {
      return (
        <div className="rounded-md bg-amber-100 border border-amber-300 text-amber-800 p-3 mb-4 text-center dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200">
          You only have {dailyRemaining} standard messages left today.
        </div>
      );
    }

    return null;
  }

  if (dailyPercentRemaining <= WARNING_THRESHOLD && dailyRemaining > 0) {
    return (
      <div className="rounded-md bg-amber-100 border border-amber-300 text-amber-800 p-3 mb-4 text-center dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200">
        You only have {dailyRemaining} messages left. Go to the{" "}
        <Link to="/profile?tab=billing">Billing</Link> page to upgrade.
      </div>
    );
  }

  if (dailyRemaining <= 0) {
    return (
      <div className="rounded-md bg-red-100 border border-red-300 text-red-800 p-3 mb-4 text-center dark:bg-red-900/30 dark:border-red-800 dark:text-red-200">
        You have no messages left. Go to the{" "}
        <Link to="/profile?tab=billing">Billing</Link> page to upgrade.
      </div>
    );
  }

  return null;
};
