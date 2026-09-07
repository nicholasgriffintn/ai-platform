import { type ShellHost, ShellHostProvider } from "@ngriffin_uk/polychat-component-shell";
import { WEB_APP_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { useAuthStatus, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { lazy, type ReactNode, Suspense, useMemo } from "react";

const LoginModal = lazy(() =>
  import("~/components/Models/LoginModal").then((mod) => ({ default: mod.LoginModal })),
);

const MetaAssistantOverlay = lazy(() =>
  import("~/components/MetaAssistant/MetaAssistantOverlay").then((mod) => ({
    default: mod.MetaAssistantOverlay,
  })),
);

const NewProjectConversationDialog = lazy(() =>
  import("~/components/Work/NewProjectConversationDialog").then((mod) => ({
    default: mod.NewProjectConversationDialog,
  })),
);

function WebShellDialogs() {
  const {
    showLoginModal,
    setShowLoginModal,
    showMetaAssistant,
    setShowMetaAssistant,
    showProjectPicker,
    setShowProjectPicker,
  } = useUIStore();

  return (
    <>
      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal
            open={showLoginModal}
            onOpenChange={setShowLoginModal}
            onKeySubmit={() => setShowLoginModal(false)}
          />
        </Suspense>
      )}
      {showMetaAssistant && (
        <Suspense fallback={null}>
          <MetaAssistantOverlay open onClose={() => setShowMetaAssistant(false)} />
        </Suspense>
      )}
      {showProjectPicker && (
        <Suspense fallback={null}>
          <NewProjectConversationDialog open onOpenChange={setShowProjectPicker} />
        </Suspense>
      )}
    </>
  );
}

export function WebShellHost({ children }: { children: ReactNode }) {
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const setShowMetaAssistant = useUIStore((state) => state.setShowMetaAssistant);
  const { logout } = useAuthStatus();

  const host = useMemo<ShellHost>(
    () => ({
      webBaseUrl: typeof window === "undefined" ? WEB_APP_BASE_URL : window.location.origin,
      openAssistant: () => setShowMetaAssistant(true),
      openSignIn: () => setShowLoginModal(true),
      signOut: () => logout(),
      HostDialogs: WebShellDialogs,
    }),
    [logout, setShowLoginModal, setShowMetaAssistant],
  );

  return <ShellHostProvider host={host}>{children}</ShellHostProvider>;
}
