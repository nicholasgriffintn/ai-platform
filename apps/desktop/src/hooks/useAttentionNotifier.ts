import { getLocalChatScope } from "@ngriffin_uk/polychat-library-chat";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useWorkAttention } from "@ngriffin_uk/polychat-library-react";
import type { WorkAttentionQuery } from "@ngriffin_uk/polychat-schemas";
import { useEffect } from "react";

import { readAnnouncements } from "../lib/attention-announcements";
import { tauriDesktopBackend } from "../lib/desktop-backend";

const WAITING_ON_YOU: WorkAttentionQuery = { limit: 25, offset: 0 };
const POLL_INTERVAL_MS = 2 * 60 * 1000;

export function useAttentionNotifier() {
  const userId = useChatStore((state) => state.user?.id);
  const attention = useWorkAttention(WAITING_ON_YOU, { refetchIntervalMs: POLL_INTERVAL_MS });
  const items = attention.data?.items;

  useEffect(() => {
    if (!items) {
      return;
    }

    const announcements = readAnnouncements(items);
    const scope = getLocalChatScope(userId);

    void tauriDesktopBackend.setAttentionBadge(announcements.length).catch(() => undefined);

    if (announcements.length > 0) {
      void tauriDesktopBackend.announceAttention(scope, announcements).catch(() => undefined);
    }
  }, [items, userId]);
}
