import { getLocalChatScope } from "@ngriffin_uk/polychat-library-chat";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useTaskAttention, useTaskNotificationSettings } from "@ngriffin_uk/polychat-library-react";
import { useEffect, useRef } from "react";

import { tauriDesktopBackend } from "../lib/desktop-backend";
import {
  readAnnouncementSignature,
  readAnnouncements,
  readAttentionBadgeCount,
} from "../lib/inbox-announcements";

export function useInboxNotifier() {
  const userId = useChatStore((state) => state.user?.id);
  const { items, unread } = useTaskAttention();
  const { settings } = useTaskNotificationSettings();
  const preferences = settings?.preferences;
  const announcedSignature = useRef("");

  useEffect(() => {
    void tauriDesktopBackend
      .setAttentionBadge(readAttentionBadgeCount(unread, preferences))
      .catch(() => undefined);
  }, [preferences, unread]);

  useEffect(() => {
    const scope = getLocalChatScope(userId);
    const announcements = readAnnouncements(items, preferences);
    const signature = readAnnouncementSignature(scope, announcements);

    if (signature === announcedSignature.current) {
      return;
    }

    announcedSignature.current = signature;

    if (announcements.length === 0) {
      return;
    }

    void tauriDesktopBackend.announceAttention(scope, announcements).catch(() => undefined);
  }, [items, preferences, userId]);
}
