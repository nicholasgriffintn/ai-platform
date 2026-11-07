import { WelcomeScreen } from "@ngriffin_uk/polychat-component-account";
import { LinkProvider } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  AnalyticsProvider,
  PolychatProvider,
  RouterLink,
  RouterNavLink,
  SurfaceControlsProvider,
  useAnalyticsAdapter,
  webSurfaceControls,
} from "@ngriffin_uk/polychat-library-react";
import { lazy, type ReactNode, Suspense, useCallback, useEffect } from "react";

import { useDesktopSession } from "./hooks/useDesktopSession";
import { isPerchWindow } from "./infrastructure/poly-bridge";

const loadDesktopWorkspace = () => import("./DesktopWorkspace");
const DesktopWorkspace = lazy(loadDesktopWorkspace);
const PerchWindow = lazy(() => import("./PerchWindow"));

function DesktopProviders({ children }: { children: ReactNode }) {
  const analytics = useAnalyticsAdapter();

  return (
    <SurfaceControlsProvider controls={webSurfaceControls}>
      <LinkProvider Link={RouterLink} NavLink={RouterNavLink}>
        <AnalyticsProvider analytics={analytics}>
          <PolychatProvider>{children}</PolychatProvider>
        </AnalyticsProvider>
      </LinkProvider>
    </SurfaceControlsProvider>
  );
}

export function App() {
  const { isChecking, isSigningIn, error, signIn, signOut } = useDesktopSession();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const handleSignIn = useCallback(() => {
    void signIn();
  }, [signIn]);
  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  useEffect(() => {
    if (isPerchWindow()) {
      return;
    }

    void loadDesktopWorkspace()
      .then(({ preloadPage }) => preloadPage(window.location.pathname))
      .catch(() => undefined);
  }, []);

  if (isPerchWindow()) {
    return (
      <DesktopProviders>
        {isChecking ? null : (
          <Suspense fallback={null}>
            <PerchWindow />
          </Suspense>
        )}
      </DesktopProviders>
    );
  }

  const welcome = (
    <WelcomeScreen
      isChecking={isChecking || isAuthenticated}
      isSigningIn={isSigningIn}
      error={error}
      onSignIn={handleSignIn}
    />
  );

  return (
    <DesktopProviders>
      {isChecking || !isAuthenticated ? (
        welcome
      ) : (
        <Suspense fallback={welcome}>
          <DesktopWorkspace onSignIn={handleSignIn} onSignOut={handleSignOut} />
        </Suspense>
      )}
    </DesktopProviders>
  );
}
