import { WelcomeScreen } from "@ngriffin_uk/polychat-component-account";
import { CustomResponseViewProvider } from "@ngriffin_uk/polychat-component-content";
import { sharedResponseViews } from "@ngriffin_uk/polychat-component-conversation";
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
          <CustomResponseViewProvider views={sharedResponseViews}>
            <PolychatProvider>{children}</PolychatProvider>
          </CustomResponseViewProvider>
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
              <DesktopRoutes />
            </DesktopShellHost>
            <ThemedToaster />
          </AppInitializer>
        </LoadingProvider>
      )}
    </DesktopProviders>
  );
}
