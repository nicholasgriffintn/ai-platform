import { CustomResponseViewProvider } from "@ngriffin_uk/polychat-component-content";
import {
  AgeGateDialog,
  AppErrorBoundary,
  ArtifactDataProvider,
  customResponseViews,
  MediaDockProvider,
} from "@ngriffin_uk/polychat-component-shell";
import { ThemedToaster } from "@ngriffin_uk/polychat-component-ui";
import { captureClientError } from "@ngriffin_uk/polychat-library-client";
import {
  AppInitializer,
  LoadingProvider,
  PageViewTracker,
  useTrackEvent,
} from "@ngriffin_uk/polychat-library-react";

import { DesktopShellHost } from "./DesktopShellHost";
import { DesktopWindowEffects } from "./DesktopWindowEffects";
import { DesktopRoutes } from "./routes";

export { preloadPage } from "./routes";

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

export default function DesktopWorkspace({
  onSignIn,
  onSignOut,
}: {
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <CustomResponseViewProvider views={customResponseViews}>
      <ArtifactDataProvider>
        <MediaDockProvider>
          <LoadingProvider>
            <AppInitializer>
              <DesktopShellHost onSignIn={onSignIn} onSignOut={onSignOut}>
                <DesktopWindowContent />
              </DesktopShellHost>
              <ThemedToaster />
              <AgeGateDialog />
            </AppInitializer>
          </LoadingProvider>
        </MediaDockProvider>
      </ArtifactDataProvider>
    </CustomResponseViewProvider>
  );
}
