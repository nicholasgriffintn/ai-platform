import { ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  WorkAttentionView,
  type WorkAttentionFilters,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useWorkAttention,
  readWorkAttentionQuery,
  workAttentionItemHref,
  writeWorkAttentionFilters,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { BriefcaseBusiness } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { AttentionBackgroundTasks } from "./AttentionBackgroundTasks.js";
import { AttentionInbox } from "./AttentionInbox.js";

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

      {isAuthenticationLoading ? null : !isAuthenticated ? (
        <SignInEmptyState
          title="Sign in to review your work"
          message="Attention only includes workspaces you can currently access."
        />
      ) : !isPro ? null : (
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

      {!isAuthenticationLoading && isAuthenticated && isPro ? (
        <div className="mt-10">
          <AttentionInbox />
        </div>
      ) : null}

      {!isAuthenticationLoading && isAuthenticated ? (
        <div className={isPro ? "mt-10" : undefined}>
          <AttentionBackgroundTasks />
        </div>
      ) : null}

      {isAuthenticated && !isPro ? (
        <EmptyState
          icon={<BriefcaseBusiness className="text-muted-foreground" size={22} />}
          title="Shared project work lives in Work"
          message="Upgrade to see blocked tasks, reviews and approvals from every workspace you belong to here."
          action={
            <ButtonLink href="/work" variant="outline" size="sm">
              See what Work includes
            </ButtonLink>
          }
          className="mt-10 min-h-[200px]"
        />
      ) : null}
    </PageShell.Content>
  );
}
