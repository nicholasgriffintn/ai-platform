import {
  type ShellHost,
  ShellDialogs,
  ShellHostProvider,
  useWebPushTaskNotificationChannel,
} from "@ngriffin_uk/polychat-component-shell";
import { WEB_APP_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { useAuthStatus, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { lazy, type ReactNode, Suspense, useMemo } from "react";

const LoginModal = lazy(() =>
  import("~/components/Models/LoginModal").then((mod) => ({ default: mod.LoginModal })),
);

function WebShellDialogs() {
  const showLoginModal = useUIStore((state) => state.showLoginModal);
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <>
      <ShellDialogs />
      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal
            open={showLoginModal}
            onOpenChange={setShowLoginModal}
            onKeySubmit={() => setShowLoginModal(false)}
          />
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
      useTaskNotificationChannel: useWebPushTaskNotificationChannel,
      HostDialogs: WebShellDialogs,
    }),
    [logout, setShowLoginModal, setShowMetaAssistant],
  );

  return <ShellHostProvider host={host}>{children}</ShellHostProvider>;
}
