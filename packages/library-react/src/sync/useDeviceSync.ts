import { getLocalChatScope } from "@ngriffin_uk/polychat-library-chat";
import {
  CHATS_QUERY_KEY,
  DeviceSyncSocket,
  setActiveSyncSocket,
  useChatStore,
  useSyncStore,
} from "@ngriffin_uk/polychat-library-client";
import { buildDeviceSyncTopic } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { applySyncEvent } from "./bindings.js";
import { createInvalidationQueue } from "./invalidation-queue.js";

export function useDeviceSync(): void {
  const queryClient = useQueryClient();
  const userId = useChatStore((state) => state.user?.id);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const conversationId = useChatStore((state) => state.currentConversationId);
  const socketRef = useRef<DeviceSyncSocket | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return undefined;
    }

    const localScope = getLocalChatScope(userId);
    const store = useSyncStore.getState();
    const queue = createInvalidationQueue(queryClient);
    const socket = new DeviceSyncSocket({
      onEvent: (event) => {
        applySyncEvent({ queryClient, localScope, invalidate: queue.push }, event);
        store.noteEvent(event.topic);
      },
      onReset: () => {
        queue.push([CHATS_QUERY_KEY, "remote"]);
      },
      onPresence: (topic, devices) => store.setPresence(topic, devices),
      onStatus: (status) => store.setStatus(status),
    });

    socketRef.current = socket;
    setActiveSyncSocket(socket);
    socket.start();
    socket.subscribe([buildDeviceSyncTopic("user", userId)]);

    return () => {
      socket.stop();
      queue.dispose();
      setActiveSyncSocket(undefined);
      socketRef.current = undefined;
    };
  }, [isAuthenticated, queryClient, userId]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) {
      return undefined;
    }

    if (!conversationId) {
      socket.focus(null);

      return undefined;
    }

    const topic = buildDeviceSyncTopic("conversation", conversationId);

    socket.subscribe([topic]);
    socket.focus(topic);

    return () => {
      socket.unsubscribe([topic]);
      useSyncStore.getState().clearPresence([topic]);
    };
  }, [conversationId]);
}
