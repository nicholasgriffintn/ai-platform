import { WelcomeScreen } from "@ngriffin_uk/polychat-component-account";
import { CustomResponseViewProvider } from "@ngriffin_uk/polychat-component-content";
import {
  ConversationHeader,
  ConversationSurface,
  sharedResponseViews,
} from "@ngriffin_uk/polychat-component-conversation";
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
import type { ReactNode } from "react";

import { useDesktopSession } from "./hooks/useDesktopSession";

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

function DesktopSessionGate({ children }: { children: ReactNode }) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const { isChecking, isSigningIn, error, signIn } = useDesktopSession();

  if (isChecking || !isAuthenticated) {
    return (
      <WelcomeScreen
        isChecking={isChecking}
        isSigningIn={isSigningIn}
        error={error}
        onSignIn={() => void signIn()}
      />
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <DesktopProviders>
      <DesktopSessionGate>
        <LoadingProvider>
          <AppInitializer>
            <ConversationSurface
              ownsWindow
              header={<ConversationHeader />}
              modeConfig={{ analyticsSource: "desktop" }}
            />
            <ThemedToaster />
          </AppInitializer>
        </LoadingProvider>
      </DesktopSessionGate>
    </DesktopProviders>
  );
}
