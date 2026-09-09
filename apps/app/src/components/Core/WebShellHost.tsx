import type { ModelSource } from "@ngriffin_uk/polychat-component-models";
import {
  type ShellHost,
  ShellDialogs,
  ShellHostProvider,
  WebPushTaskNotificationSettings,
} from "@ngriffin_uk/polychat-component-shell";
import { useChatStore, WEB_APP_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { useAuthStatus, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { lazy, type ReactNode, Suspense, useMemo } from "react";
import { useNavigate } from "react-router";

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
  const setComputeSite = useChatStore((state) => state.setComputeSite);
  const { logout } = useAuthStatus();
  const navigate = useNavigate();
  const modelSourceRows = useMemo<readonly ModelSource[]>(
    () => [
      {
        id: "browser-webllm",
        name: "This browser",
        detail: "WebLLM. Downloads once, then runs here.",
        readiness: "available",
        action: {
          label: "Try it",
          onSelect: () => {
            setComputeSite("browser");
            void navigate("/chat");
          },
        },
      },
      {
        id: "desktop-models",
        name: "Your machines",
        detail: "None yet",
        readiness: "not-connected",
        action: {
          label: "Get the desktop app",
          onSelect: () => navigate("/downloads"),
        },
      },
    ],
    [navigate, setComputeSite],
  );

  const host = useMemo<ShellHost>(
    () => ({
      webBaseUrl: typeof window === "undefined" ? WEB_APP_BASE_URL : window.location.origin,
      openAssistant: () => setShowMetaAssistant(true),
      openSignIn: () => setShowLoginModal(true),
      signOut: () => logout(),
      TaskNotificationSettings: WebPushTaskNotificationSettings,
      HostDialogs: WebShellDialogs,
      modelSourceSurface: "web",
      modelSourceRows,
      openProviderSettings: () => void navigate("/profile?tab=providers"),
    }),
    [logout, modelSourceRows, navigate, setShowLoginModal, setShowMetaAssistant],
  );

  return <ShellHostProvider host={host}>{children}</ShellHostProvider>;
}
