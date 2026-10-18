import { type CharacterPresence, useCharacterPresence } from "@ngriffin_uk/polychat-library-react";

export function usePetStatus(conversationId?: string | null): CharacterPresence["status"] {
  return useCharacterPresence({ conversationId }).status;
}
