import {
  WorkAccessEmptyState,
  WorkAttentionView,
  type WorkAttentionFilters,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useWorkAttention } from "~/hooks/useWorkAttention";
import { getErrorMessage } from "~/lib/errors";
import {
  readWorkAttentionQuery,
  workAttentionItemHref,
  writeWorkAttentionFilters,
} from "~/lib/work-attention";
import { useChatStore } from "~/state/stores/chatStore";

export function AttentionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readWorkAttentionQuery(searchParams), [searchParams]);
  const attention = useWorkAttention(query);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);
  const filters: WorkAttentionFilters = {
    kind: query.kind,
    workspaceId: query.workspaceId,
    projectId: query.projectId,
    ownerUserId: query.ownerUserId,
    type: query.type,
    from: query.from,
    to: query.to,
  };

  return (
    <PageShell.Content className="max-w-6xl">
      <PageShell.Header title="Attention" />
      <p className="text-muted-foreground mb-6 text-sm">
        Review actionable and recent work across every workspace you can currently access.
      </p>

      {isAuthenticationLoading ? null : !isAuthenticated ? (
        <SignInEmptyState
          title="Sign in to review your work"
          message="Attention only includes workspaces you can currently access."
        />
      ) : !isPro ? (
        <WorkAccessEmptyState />
      ) : (
        <WorkAttentionView
          items={attention.data?.items ?? []}
          facets={attention.data?.facets}
          filters={filters}
          total={attention.data?.total ?? 0}
          offset={query.offset}
          limit={query.limit}
          isLoading={attention.isLoading}
          errorMessage={
            attention.error
              ? getErrorMessage(attention.error, "Attention could not be loaded")
              : undefined
          }
          itemHref={workAttentionItemHref}
          onFiltersChange={(nextFilters) =>
            setSearchParams(writeWorkAttentionFilters(nextFilters, query.limit))
          }
          onPageChange={(offset) =>
            setSearchParams(writeWorkAttentionFilters(filters, query.limit, offset))
          }
        />
      )}
    </PageShell.Content>
  );
}
