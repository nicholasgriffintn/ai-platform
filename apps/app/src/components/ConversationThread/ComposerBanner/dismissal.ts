import { create } from "zustand";

const KEY_PREFIX = "polychat:composer-banner:";
const DISMISSED_SUFFIX = ":dismissed";
const SUGGESTION_COOLDOWN_KEY = `${KEY_PREFIX}suggestion-cooldown-until`;
const SUGGESTION_COOLDOWN_DAYS = 3;

export type { ComposerBannerDismissalScope as BannerDismissalScope } from "@ngriffin_uk/polychat-component-conversation";
import type { ComposerBannerDismissalScope as BannerDismissalScope } from "@ngriffin_uk/polychat-component-conversation";

const todayStamp = () => new Date().toISOString().slice(0, 10);

const dismissalKey = (id: string) => `${KEY_PREFIX}${id}${DISMISSED_SUFFIX}`;

function readDismissals(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  const dismissals: Record<string, string> = {};
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(KEY_PREFIX) && key.endsWith(DISMISSED_SUFFIX)) {
      const id = key.slice(KEY_PREFIX.length, -DISMISSED_SUFFIX.length);
      dismissals[id] = window.localStorage.getItem(key) ?? "";
    }
  }
  return dismissals;
}

function readCooldownUntil(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const value = Number(window.localStorage.getItem(SUGGESTION_COOLDOWN_KEY));
  return Number.isFinite(value) ? value : 0;
}

interface ComposerBannerDismissalStore {
  dismissals: Record<string, string>;
  cooldownUntil: number;
  dismiss: (id: string, scope: BannerDismissalScope, suggestion?: boolean) => void;
}

export const useComposerBannerDismissals = create<ComposerBannerDismissalStore>()((set) => ({
  dismissals: readDismissals(),
  cooldownUntil: readCooldownUntil(),
  dismiss: (id, scope, suggestion) =>
    set((state) => {
      const value = scope === "forever" ? "forever" : todayStamp();
      let cooldownUntil = state.cooldownUntil;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(dismissalKey(id), value);
      }
      if (suggestion) {
        cooldownUntil = Date.now() + SUGGESTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SUGGESTION_COOLDOWN_KEY, String(cooldownUntil));
        }
      }
      return {
        dismissals: { ...state.dismissals, [id]: value },
        cooldownUntil,
      };
    }),
}));

export function isDismissed(
  dismissals: Record<string, string>,
  id: string,
  scope: BannerDismissalScope,
): boolean {
  const value = dismissals[id];
  if (!value) {
    return false;
  }
  if (value === "forever") {
    return true;
  }
  return scope === "day" && value === todayStamp();
}
