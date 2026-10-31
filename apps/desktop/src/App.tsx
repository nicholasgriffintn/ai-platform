import { WelcomeScreen } from "@ngriffin_uk/polychat-component-account";
import { CustomResponseViewProvider } from "@ngriffin_uk/polychat-component-content";
import {
  AgeGateDialog,
  AppErrorBoundary,
  ArtifactDataProvider,
  customResponseViews,
  MediaDockProvider,
} from "@ngriffin_uk/polychat-component-shell";
import { LinkProvider, ThemedToaster } from "@ngriffin_uk/polychat-component-ui";
import { captureClientError, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  AnalyticsProvider,
  AppInitializer,
  LoadingProvider,
  PolychatProvider,
  RouterLink,
  RouterNavLink,
  SurfaceControlsProvider,
  useAnalyticsAdapter,
  PageViewTracker,
  useTrackEvent,
  webSurfaceControls,
} from "@ngriffin_uk/polychat-library-react";
import { type ReactNode, useCallback } from "react";

import { DesktopShellHost } from "./DesktopShellHost";
import { DesktopWindowEffects } from "./DesktopWindowEffects";
import { useDesktopSession } from "./hooks/useDesktopSession";
import { isPerchWindow } from "./infrastructure/poly-bridge";
import { PerchWindow } from "./PerchWindow";
import { DesktopRoutes } from "./routes";

function DesktopProviders({ children }: { children: ReactNode }) {
  const analytics = useAnalyticsAdapter();

  return (
    <SurfaceControlsProvider controls={webSurfaceControls}>
      <LinkProvider Link={RouterLink} NavLink={RouterNavLink}>
        <AnalyticsProvider analytics={analytics}>
          <CustomResponseViewProvider views={customResponseViews}>
            <ArtifactDataProvider>
              <PolychatProvider>
                <MediaDockProvider>{children}</MediaDockProvider>
              </PolychatProvider>
            </ArtifactDataProvider>
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
      onError={(error) => {
        captureClientError(error);
        trackException(error, {
          message: "Error",
          details: error.message,
          stack: error.stack,
        });
      }}
    >
      <DesktopWindowEffects />
      <PageViewTracker />
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

  if (isPerchWindow()) {
    return <DesktopProviders>{isChecking ? null : <PerchWindow />}</DesktopProviders>;
  }

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
            <AgeGateDialog />
          </AppInitializer>
        </LoadingProvider>
      )}
    </DesktopProviders>
  );
}
