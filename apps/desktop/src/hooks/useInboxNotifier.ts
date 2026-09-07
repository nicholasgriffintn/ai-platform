import { getLocalChatScope } from "@ngriffin_uk/polychat-library-chat";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useTaskAttention, useTaskNotificationSettings } from "@ngriffin_uk/polychat-library-react";
import { useEffect } from "react";

import { tauriDesktopBackend } from "../lib/desktop-backend";
import { readAnnouncements } from "../lib/inbox-announcements";

export function useInboxNotifier() {
  const userId = useChatStore((state) => state.user?.id);
  const { items, unread } = useTaskAttention();
  const { settings } = useTaskNotificationSettings();
  const preferences = settings?.preferences;

  useEffect(() => {
    void tauriDesktopBackend.setAttentionBadge(unread).catch(() => undefined);
  }, [unread]);

  useEffect(() => {
    const announcements = readAnnouncements(items, preferences);

    if (announcements.length === 0) {
      return;
    }

    void tauriDesktopBackend
      .announceAttention(getLocalChatScope(userId), announcements)
      .catch(() => undefined);
  }, [items, preferences, userId]);
}
