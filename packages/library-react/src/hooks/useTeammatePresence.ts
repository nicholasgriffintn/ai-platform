import { useChatStore } from "@ngriffin_uk/polychat-library-client";

import { type CharacterPresence, deriveTeammatePresence } from "../lib/pet/presence.js";
import { usePolyAgenda } from "./usePolyAgenda.js";

export function useTeammatePresence(
  teammateId: string | null | undefined,
): Pick<CharacterPresence, "state" | "status" | "accent"> {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const { data: agenda } = usePolyAgenda(isAuthenticated && Boolean(teammateId));

  return deriveTeammatePresence(
    agenda ? { needsYou: agenda.needs_you, workingOn: agenda.working_on } : null,
    teammateId ?? "",
  );
}
