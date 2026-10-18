import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useCharacterPresence,
  usePolyAgenda,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect } from "react";

import { onOpenPoly, showPolyPresence } from "../infrastructure/poly-bridge";

export function usePolyDesktopBridge() {
  const setShowPoly = useUIStore((state) => state.setShowPoly);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const { data: agenda } = usePolyAgenda(isAuthenticated);
  const presence = useCharacterPresence({ conversationId: agenda?.conversation_id });

  useEffect(() => onOpenPoly(() => setShowPoly(true)), [setShowPoly]);

  useEffect(() => {
    void showPolyPresence(presence.status, presence.needsYou).catch(() => undefined);
  }, [presence.needsYou, presence.status]);
}
