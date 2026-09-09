import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { WorkAccessEmptyState } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { ReactNode } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";

export function WorkAccessGate({
  children,
  requiresAuthentication,
}: {
  children: ReactNode;
  requiresAuthentication: boolean;
}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);

  if (!requiresAuthentication) {
    return children;
  }

  if (isAuthenticationLoading) {
    return <PageStatus message="Loading workspace…" className="h-full min-h-[360px]" />;
  }

  if (!isAuthenticated) {
    return (
      <SignInEmptyState
        title="Sign in to continue"
        message="Sign in to access this workspace and its projects."
        className="min-h-[360px] border-0 bg-transparent dark:bg-transparent"
      />
    );
  }

  if (!isPro) {
    return (
      <div className="p-4 sm:p-8">
        <WorkAccessEmptyState />
      </div>
    );
  }

  return children;
}
