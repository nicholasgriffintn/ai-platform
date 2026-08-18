import { isStealthModel } from "@ngriffin_uk/polychat-schemas";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useMemo } from "react";

import { useRecipeConnectors } from "~/hooks/useConnectors";
import { useUser } from "~/hooks/useUser";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import { useChatStore } from "~/state/stores/chatStore";
import { type UsageLimits, useUsageStore } from "~/state/stores/usageStore";

import { isDismissed, useComposerBannerDismissals } from "./dismissal";

export const STEALTH_MODEL_WARNING =
  "Note: Prompts and completions may be logged by the provider and used to improve the model.";

const USAGE_WARNING_THRESHOLD = 0.2;
const CONNECTOR_SUGGESTION_MIN_MESSAGES = 10;
const WORK_SUGGESTION_MIN_MESSAGES = 20;

import type {
  ComposerBannerDescriptor,
  ComposerBannerTone,
} from "@ngriffin_uk/polychat-component-conversation";

export type { ComposerBannerDescriptor, ComposerBannerTone };

interface ComposerBannerOptions {
  model?: ModelConfigItem;
  hideSuggestions?: boolean;
}

export function useComposerBanner({ model, hideSuggestions }: ComposerBannerOptions) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);
  const user = useChatStore((state) => state.user);
  const hasHydratedUserConfiguration = useChatStore((state) => state.hasHydratedUserConfiguration);
  const usageLimits = useUsageStore((state) => state.usageLimits);
  const { providerSettings, isLoadingProviderSettings } = useUser({ enabled: isAuthenticated });
  const { data: connectorsData } = useRecipeConnectors();
  const { data: workspacesData } = useWorkspaces();
  const dismissals = useComposerBannerDismissals((state) => state.dismissals);
  const cooldownUntil = useComposerBannerDismissals((state) => state.cooldownUntil);
  const storeDismiss = useComposerBannerDismissals((state) => state.dismiss);

  const banner = useMemo(() => {
    const candidates: Array<ComposerBannerDescriptor | null> = [
      buildUsageBanner(usageLimits, isPro),
      isStealthModel(model)
        ? { id: "stealth-model", tone: "warning", message: STEALTH_MODEL_WARNING }
        : null,
    ];

    const suggestionsAllowed =
      !hideSuggestions &&
      isAuthenticated &&
      hasHydratedUserConfiguration &&
      cooldownUntil <= Date.now();

    if (suggestionsAllowed) {
      const messageCount = user?.message_count ?? 0;

      if (!isLoadingProviderSettings && !providerSettings.some((p) => p.hasApiKey)) {
        candidates.push({
          id: "provider-setup",
          tone: "info",
          title: "Bring your own models",
          message: isPro
            ? "Add provider keys to reach the full model catalogue beyond your Pro allowance."
            : "Add provider keys to use your own models without message limits.",
          action: { label: "Open Providers", to: "/profile?tab=providers" },
          dismissal: { scope: "forever", suggestion: true },
        });
      }

      if (
        isPro &&
        connectorsData &&
        !connectorsData.connectors.some((c) => c.status === "connected") &&
        messageCount >= CONNECTOR_SUGGESTION_MIN_MESSAGES
      ) {
        candidates.push({
          id: "connectors-suggest",
          tone: "info",
          title: "Connect your tools",
          message:
            "Link Gmail, Notion, and friends so Polychat can do things for you, not just discuss them.",
          action: { label: "Browse connectors", to: "/profile?tab=providers" },
          dismissal: { scope: "forever", suggestion: true },
        });
      }

      if (messageCount >= WORK_SUGGESTION_MIN_MESSAGES) {
        if (isPro && workspacesData && workspacesData.workspaces.length === 0) {
          candidates.push({
            id: "work-suggest",
            tone: "info",
            title: "Give Work a try",
            message:
              "Shared workspaces for bigger jobs — projects, sources, and outputs kept in one tidy nest.",
            action: { label: "Open Work", to: "/work" },
            dismissal: { scope: "forever", suggestion: true },
          });
        } else if (!isPro) {
          candidates.push({
            id: "work-upsell",
            tone: "info",
            title: "Work comes with Pro",
            message:
              "Shared workspaces, projects, and a place for everything they produce. Included with Pro.",
            action: { label: "See plans", to: "/profile?tab=billing" },
            dismissal: { scope: "forever", suggestion: true },
          });
        }
      }
    }

    return (
      candidates.find(
        (candidate): candidate is ComposerBannerDescriptor =>
          candidate !== null &&
          (!candidate.dismissal ||
            !isDismissed(dismissals, candidate.id, candidate.dismissal.scope)),
      ) ?? null
    );
  }, [
    usageLimits,
    isPro,
    model,
    hideSuggestions,
    isAuthenticated,
    hasHydratedUserConfiguration,
    user,
    providerSettings,
    isLoadingProviderSettings,
    connectorsData,
    workspacesData,
    dismissals,
    cooldownUntil,
  ]);

  const dismiss = useCallback(() => {
    if (!banner?.dismissal) {
      return;
    }
    storeDismiss(banner.id, banner.dismissal.scope, banner.dismissal.suggestion);
  }, [banner, storeDismiss]);

  return { banner, dismiss };
}

function buildUsageBanner(
  usageLimits: UsageLimits | null,
  isPro: boolean,
): ComposerBannerDescriptor | null {
  if (!usageLimits) {
    return null;
  }

  const { daily, pro } = usageLimits;
  const dailyRemaining = daily.limit - daily.used;

  if (dailyRemaining <= 0) {
    return {
      id: "usage-daily-exhausted",
      tone: "critical",
      title: "Out of messages for today",
      message: isPro
        ? "Your daily allowance has run dry. Your own provider keys still work, if you have them configured."
        : "Your daily allowance has run dry. Upgrade to Pro or add your own provider keys to keep going.",
      action: isPro
        ? { label: "Open Providers", to: "/profile?tab=providers" }
        : { label: "See plans", to: "/profile?tab=billing" },
    };
  }

  if (isPro && pro) {
    const proRemaining = pro.limit - pro.used;
    if (proRemaining <= 0) {
      return {
        id: "usage-pro-exhausted",
        tone: "warning",
        message:
          "That was the last of today's Pro messages. Standard models are still on the perch.",
        dismissal: { scope: "day" },
      };
    }
    if (proRemaining / pro.limit <= USAGE_WARNING_THRESHOLD) {
      return {
        id: "usage-pro-low",
        tone: "warning",
        message: `You have ${proRemaining} Pro ${proRemaining === 1 ? "message" : "messages"} left today.`,
        dismissal: { scope: "day" },
      };
    }
  }

  if (daily.limit > 0 && dailyRemaining / daily.limit <= USAGE_WARNING_THRESHOLD) {
    return {
      id: "usage-daily-low",
      tone: "warning",
      message: isPro
        ? `You have ${dailyRemaining} standard ${dailyRemaining === 1 ? "message" : "messages"} left today.`
        : `You have ${dailyRemaining} ${dailyRemaining === 1 ? "message" : "messages"} left today. Pro raises the ceiling, and your own keys remove it.`,
      action: isPro ? undefined : { label: "See plans", to: "/profile?tab=billing" },
      dismissal: { scope: "day" },
    };
  }

  return null;
}
