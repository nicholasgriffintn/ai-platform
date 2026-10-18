import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { TeammateContext, TeammateContextScope } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo } from "react";

import { useTeammateContexts } from "./useTeammateContexts.js";

export interface TeammateHome {
  context: TeammateContext | undefined;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  updateStatus: ReturnType<typeof useTeammateContexts>["updateStatus"];
}

function matchesScope(context: TeammateContext, scope: TeammateContextScope): boolean {
  return context.scope.type === scope.type && context.scope.id === scope.id;
}

export function useTeammateHome(teammateId: string, projectId?: string): TeammateHome {
  const userId = useChatStore((state) => state.user?.id);
  const { contexts, isLoading, isFetched, error, ensure, updateStatus, refetch } =
    useTeammateContexts(teammateId);
  const scope = useMemo<TeammateContextScope | null>(
    () =>
      projectId
        ? { type: "project", id: projectId }
        : userId
          ? { type: "personal", id: String(userId) }
          : null,
    [projectId, userId],
  );
  const context = scope ? contexts.find((item) => matchesScope(item, scope)) : undefined;
  const shouldEnsure = Boolean(
    scope && isFetched && !context && !ensure.isPending && !ensure.error,
  );

  useEffect(() => {
    if (shouldEnsure && scope) {
      ensure.mutate({ teammateId, scope });
    }
  }, [ensure, scope, shouldEnsure, teammateId]);

  return {
    context,
    isLoading: isLoading || ensure.isPending,
    error: error ?? ensure.error,
    retry: () => {
      ensure.reset();
      void refetch();
    },
    updateStatus,
  };
}
