import { useChatStore, useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import type { PolyAgenda } from "@ngriffin_uk/polychat-schemas";
import { formatClockTime } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useRef, useState } from "react";

import {
  type CharacterAgendaSignal,
  type CharacterPresence,
  deriveCharacterPresence,
  PET_ACKNOWLEDGE_WINDOW_MS,
  PET_CHEER_WINDOW_MS,
  PET_REACTION_WINDOW_MS,
} from "../lib/pet/presence.js";
import { usePetStore } from "../state/stores/petStore.js";
import { usePolyAgenda } from "./usePolyAgenda.js";

const ACTIVE_TICK_MS = 1000;
const QUIET_TICK_MS = Math.min(
  PET_CHEER_WINDOW_MS,
  PET_ACKNOWLEDGE_WINDOW_MS,
  PET_REACTION_WINDOW_MS,
);

export interface CharacterPresenceOptions {
  conversationId?: string | null;
}

function agendaSignal(agenda: PolyAgenda | undefined): CharacterAgendaSignal | null {
  if (!agenda) {
    return null;
  }

  return {
    needsYou: agenda.needs_you.length,
    workingOn: agenda.working_on.length,
    pausedUntil: agenda.paused_until,
  };
}

function useArrivals(agenda: PolyAgenda | undefined): number | null {
  const known = useRef<Set<string> | null>(null);
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!agenda) {
      return;
    }

    const ids = new Set(
      [...agenda.needs_you, ...agenda.working_on].map((item) => `${item.kind}:${item.id}`),
    );
    const previous = known.current;

    known.current = ids;

    if (previous && [...ids].some((id) => !previous.has(id))) {
      setArrivedAt(Date.now());
    }
  }, [agenda]);

  return arrivedAt;
}

export function useCharacterPresence(options: CharacterPresenceOptions = {}): CharacterPresence {
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const conversationId = options.conversationId ?? currentConversationId;
  const activity = useStreamActivityStore(
    (state) => (conversationId ? state.streams[conversationId]?.activity : null) ?? null,
  );
  const reviewing = usePetStore((state) =>
    conversationId ? conversationId in state.reviewing : false,
  );
  const lastReaction = usePetStore((state) => state.reaction);
  const voice = usePetStore((state) =>
    state.listening ? "listening" : state.speaking ? "speaking" : "off",
  );
  const { data: agenda } = usePolyAgenda(isAuthenticated);
  const lastArrivedAt = useArrivals(agenda);
  const lastCompletedAt = useRef<number | null>(null);
  const lastActiveAt = useRef<number | null>(null);
  const wasActive = useRef(false);

  const signal = agendaSignal(agenda);
  const needsYou = signal?.needsYou ?? 0;
  const workingOn = signal?.workingOn ?? 0;
  const pausedUntil = signal?.pausedUntil ?? null;

  const [presence, setPresence] = useState<CharacterPresence>(() =>
    deriveCharacterPresence({
      activity: null,
      isRecovering: false,
      voice: "off",
      reviewing: false,
      agenda: null,
      lastCompletedAt: null,
      lastActiveAt: null,
      lastArrivedAt: null,
      lastReaction: null,
      now: Date.now(),
      formatTime: formatClockTime,
    }),
  );

  useEffect(() => {
    const isActive = activity !== null;

    if (isActive) {
      lastActiveAt.current = Date.now();
    } else if (wasActive.current) {
      lastCompletedAt.current = Date.now();
    }

    wasActive.current = isActive;
  }, [activity]);

  useEffect(() => {
    function update() {
      setPresence(
        deriveCharacterPresence({
          activity,
          isRecovering: false,
          voice,
          reviewing,
          agenda: isAuthenticated ? { needsYou, workingOn, pausedUntil } : null,
          lastCompletedAt: lastCompletedAt.current,
          lastActiveAt: lastActiveAt.current,
          lastArrivedAt,
          lastReaction,
          now: Date.now(),
          formatTime: formatClockTime,
        }),
      );
    }

    update();

    const interval = window.setInterval(update, activity ? ACTIVE_TICK_MS : QUIET_TICK_MS);

    return () => window.clearInterval(interval);
  }, [
    activity,
    voice,
    reviewing,
    isAuthenticated,
    needsYou,
    workingOn,
    pausedUntil,
    lastArrivedAt,
    lastReaction,
  ]);

  return presence;
}
