import { WelcomeScreen } from "@ngriffin_uk/polychat-component-account";
import { CustomResponseViewProvider } from "@ngriffin_uk/polychat-component-content";
import { AppErrorBoundary, customResponseViews } from "@ngriffin_uk/polychat-component-shell";
import { LinkProvider, ThemedToaster } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  AnalyticsProvider,
  AppInitializer,
  LoadingProvider,
  PolychatProvider,
  RouterLink,
  RouterNavLink,
  SurfaceControlsProvider,
  useAnalyticsAdapter,
  useTrackEvent,
  webSurfaceControls,
} from "@ngriffin_uk/polychat-library-react";
import { type ReactNode, useCallback } from "react";

import { DesktopShellHost } from "./DesktopShellHost";
import { useDesktopSession } from "./hooks/useDesktopSession";
import { DesktopRoutes } from "./routes";

function DesktopProviders({ children }: { children: ReactNode }) {
  const analytics = useAnalyticsAdapter();

  return (
    <SurfaceControlsProvider controls={webSurfaceControls}>
      <LinkProvider Link={RouterLink} NavLink={RouterNavLink}>
        <AnalyticsProvider analytics={analytics}>
          <CustomResponseViewProvider views={customResponseViews}>
            <PolychatProvider>{children}</PolychatProvider>
          </CustomResponseViewProvider>
        </AnalyticsProvider>
      </LinkProvider>
    </SurfaceControlsProvider>
  );
}

function DesktopWindowContent() {
  const { trackException } = useTrackEvent();

  return (
    <AppErrorBoundary
      onError={(error) =>
        trackException(error, {
          message: "Error",
          details: error.message,
          stack: error.stack,
        })
      }
    >
      <DesktopRoutes />
    </AppErrorBoundary>
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

  return (
    <DesktopProviders>
      {isChecking || !isAuthenticated ? (
        <WelcomeScreen
          isChecking={isChecking}
          isSigningIn={isSigningIn}
          error={error}
          onSignIn={handleSignIn}
        />
      ) : (
        <LoadingProvider>
          <AppInitializer>
            <DesktopShellHost onSignIn={handleSignIn} onSignOut={handleSignOut}>
              <DesktopWindowContent />
            </DesktopShellHost>
            <ThemedToaster />
          </AppInitializer>
        </LoadingProvider>
      )}
    </DesktopProviders>
  );
}
