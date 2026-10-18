import { apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  buildTeammateRoster,
  TEAMMATE_ROSTER_QUERY_KEY,
  type RosterRow,
} from "../lib/teammates/roster.js";
import { useConversationOrganisation } from "./useConversationOrganisation.js";
import { usePolyAgenda } from "./usePolyAgenda.js";
import { useTeammates } from "./useTeammates.js";

function useRosterEntries() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: TEAMMATE_ROSTER_QUERY_KEY,
    queryFn: () => apiService.listTeammateRoster(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

export function useTeammateRoster(): RosterRow[] {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const { data: entries = [] } = useRosterEntries();
  const { teammates } = useTeammates({ enabled: isAuthenticated && entries.length > 0 });
  const { data: agenda } = usePolyAgenda(isAuthenticated && entries.length > 0);

  return buildTeammateRoster({
    entries,
    teammates,
    signal: agenda ? { needsYou: agenda.needs_you, workingOn: agenda.working_on } : null,
  });
}

export function useMarkRosterThreadRead(conversationId: string | undefined): void {
  const { data: entries = [] } = useRosterEntries();
  const unread = entries.some((entry) => entry.conversationId === conversationId && entry.unread);
  const organisation = useConversationOrganisation(
    unread && conversationId ? conversationId : null,
  );
  const { mutate, isPending } = organisation.update;

  useEffect(() => {
    if (unread && !isPending) {
      mutate({ isUnread: false });
    }
  }, [isPending, mutate, unread]);
}
