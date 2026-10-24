import { useChatStore } from "@ngriffin_uk/polychat-library-client";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { DiscoverEditionView } from "./Edition/DiscoverEditionView.js";

export function DiscoverPage() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);

  if (isAuthenticationLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <PageShell.Content className="max-w-3xl">
        <PageShell.Header title="Discover" />
        <SignInEmptyState
          title="Sign in for your morning edition"
          message="Discover is built from your own chats, so it needs to know who you are."
        />
      </PageShell.Content>
    );
  }

  return <DiscoverEditionView />;
}
