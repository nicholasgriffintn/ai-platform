import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";

export function WorkPageFailure({
  title,
  error,
  fallbackMessage,
  signInTitle,
  signInMessage,
  className = "max-w-6xl",
}: {
  title: string;
  error: Error | null;
  fallbackMessage: string;
  signInTitle: string;
  signInMessage: string;
  className?: string;
}) {
  return (
    <PageShell.Content className={className}>
      <PageShell.Header title={title} />
      {isAuthenticationError(error) ? (
        <SignInEmptyState title={signInTitle} message={signInMessage} className="min-h-[300px]" />
      ) : (
        <p role="alert" className="text-sm text-failure">
          {error?.message ?? fallbackMessage}
        </p>
      )}
    </PageShell.Content>
  );
}
