import { EnterpriseSignInForm, WelcomeScreen } from "@ngriffin_uk/polychat-component-account";
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
  createPolychatQueryClient,
} from "@ngriffin_uk/polychat-library-react";
import type { QueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";

import { DesktopShellHost } from "./DesktopShellHost";
import { DesktopWindowEffects } from "./DesktopWindowEffects";
import { useDesktopSession } from "./hooks/useDesktopSession";
import { DesktopRoutes } from "./routes";

function DesktopProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const analytics = useAnalyticsAdapter();

  return (
    <SurfaceControlsProvider controls={webSurfaceControls}>
      <LinkProvider Link={RouterLink} NavLink={RouterNavLink}>
        <AnalyticsProvider analytics={analytics}>
          <CustomResponseViewProvider views={customResponseViews}>
            <PolychatProvider queryClient={queryClient}>{children}</PolychatProvider>
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
      <DesktopWindowEffects />
      <DesktopRoutes />
    </AppErrorBoundary>
  );
}

export function App() {
  const [queryClient] = useState(() => createPolychatQueryClient());
  const clearAccountCache = useCallback(() => queryClient.clear(), [queryClient]);
  const { isChecking, isSigningIn, error, signIn, signOut } = useDesktopSession(clearAccountCache);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const handleSignIn = useCallback(() => {
    void signIn();
  }, [signIn]);
  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);
  const handleEnterpriseSignIn = useCallback(
    (id: string, link: boolean) => {
      void signIn(id, link).then((message) => {
        if (message) {
          toast.error(message);
        } else {
          void queryClient.invalidateQueries();
        }

        return undefined;
      });
    },
    [queryClient, signIn],
  );

  return (
    <DesktopProviders queryClient={queryClient}>
      {isChecking || !isAuthenticated ? (
        <WelcomeScreen
          isChecking={isChecking}
          isSigningIn={isSigningIn}
          error={error}
          onSignIn={handleSignIn}
          alternativeSignIn={
            <EnterpriseSignInForm
              isPending={isSigningIn}
              onSignIn={(id) => handleEnterpriseSignIn(id, false)}
            />
          }
        />
      ) : (
        <LoadingProvider>
          <AppInitializer>
            <DesktopShellHost
              onSignIn={handleSignIn}
              onEnterpriseSignIn={handleEnterpriseSignIn}
              onSignOut={handleSignOut}
            >
              <DesktopWindowContent />
            </DesktopShellHost>
            <ThemedToaster />
          </AppInitializer>
        </LoadingProvider>
      )}
    </DesktopProviders>
  );
}
