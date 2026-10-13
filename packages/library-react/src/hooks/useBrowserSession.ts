import {
  destroyBrowserSession,
  fetchBrowserSession,
  stopBrowserSession,
  submitBrowserApproval,
} from "@ngriffin_uk/polychat-library-client";
import type { SubmitBrowserApproval } from "@ngriffin_uk/polychat-schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

export function useBrowserSession(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closed, setClosed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryKey = ["browser-session", sessionId];
  const query = useQuery({
    queryKey,
    queryFn: () => fetchBrowserSession(sessionId ?? ""),
    enabled: Boolean(sessionId) && !closed,
    retry: false,
    gcTime: 0,
    refetchInterval: (state) =>
      state.state.error ||
      ["completed", "failed", "cancelled"].includes(state.state.data?.status ?? "")
        ? false
        : 2000,
  });

  const run = async (action: () => Promise<void>, close = false) => {
    if (!sessionId || busy.current) {
      return;
    }

    busy.current = true;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await action();
      if (close) {
        setClosed(true);
        queryClient.removeQueries({ queryKey });
      } else {
        await query.refetch();
      }
    } catch {
      setActionError(
        "The browser update could not be confirmed. Refresh its state before trying again.",
      );
      await query.refetch();
    } finally {
      busy.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    ...query,
    closed,
    isSubmitting,
    actionError,
    respond: (input: SubmitBrowserApproval) =>
      run(() => submitBrowserApproval(sessionId ?? "", input)),
    stop: () => run(() => stopBrowserSession(sessionId ?? "")),
    destroy: () => run(() => destroyBrowserSession(sessionId ?? ""), true),
  };
}
