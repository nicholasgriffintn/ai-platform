import { Button, ButtonLink, EmptyState, PageStatus } from "@ngriffin_uk/polychat-component-ui";
import {
  isAuthenticationError,
  isNotFoundError,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { Crown, SearchX, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";

const STATE_CLASS = "m-4 min-h-[320px] sm:m-8";

export function TeammatePageState({
  noun,
  isLoading,
  error,
  isFound,
  backPath,
  onRetry,
  children,
}: {
  noun: "teammate" | "group";
  isLoading: boolean;
  error: unknown;
  isFound: boolean;
  backPath: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);

  if (isAuthenticationLoading || (isLoading && !error)) {
    return <PageStatus message={`Loading ${noun}…`} className="h-full min-h-[320px]" />;
  }

  if (!isAuthenticated || isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to work with teammates"
        message="Teammates keep their conversations and work in your account."
        className={STATE_CLASS}
      />
    );
  }

  if (!isPro) {
    return (
      <EmptyState
        icon={<Crown size={22} className="text-muted-foreground" />}
        title="Teammates come with Pro"
        message="Upgrade to hire teammates and keep a conversation going with each of them."
        action={
          <ButtonLink href="/profile?tab=billing" variant="primary" size="sm">
            Upgrade to Pro
          </ButtonLink>
        }
        className={STATE_CLASS}
      />
    );
  }

  if (error && !isNotFoundError(error)) {
    return (
      <EmptyState
        icon={<TriangleAlert size={22} className="text-muted-foreground" />}
        title={`Could not load this ${noun}`}
        message="Something went wrong on our side. Try again in a moment."
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
        className={STATE_CLASS}
      />
    );
  }

  if (!isFound) {
    return (
      <EmptyState
        icon={<SearchX size={22} className="text-muted-foreground" />}
        title={noun === "group" ? "Group not found" : "Teammate not found"}
        message="It may have been removed, or it belongs to someone else."
        action={
          <ButtonLink href={backPath} variant="outline" size="sm">
            Back to teammates
          </ButtonLink>
        }
        className={STATE_CLASS}
      />
    );
  }

  return children;
}
