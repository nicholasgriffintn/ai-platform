import { ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  WorkAttentionView,
  type WorkAttentionFilters,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useCursorPages,
  useWorkAttention,
  readWorkAttentionQuery,
  workAttentionFiltersOf,
  workAttentionItemHref,
  writeWorkAttentionFilters,
} from "@ngriffin_uk/polychat-library-react";
import { nextPageCursor } from "@ngriffin_uk/polychat-schemas";
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
  const pages = useCursorPages();
  const attention = useWorkAttention({ ...query, after: pages.cursor });
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);
  const filters: WorkAttentionFilters = workAttentionFiltersOf(query);
  const nextCursor = attention.data ? nextPageCursor(attention.data) : undefined;

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
          items={attention.data?.data ?? []}
          facets={attention.data?.facets}
          filters={filters}
          total={attention.data?.total ?? 0}
          page={pages.page}
          limit={query.limit}
          hasPrevious={pages.hasPrevious}
          hasNext={Boolean(nextCursor)}
          isLoading={attention.isLoading}
          errorMessage={
            attention.error
              ? getErrorMessage(attention.error, "Attention could not be loaded")
              : undefined
          }
          itemHref={workAttentionItemHref}
          onFiltersChange={(nextFilters) => {
            pages.reset();
            setSearchParams(writeWorkAttentionFilters(nextFilters, query.limit));
          }}
          onPrevious={pages.previous}
          onNext={() => pages.next(nextCursor)}
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
