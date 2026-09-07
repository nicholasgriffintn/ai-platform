import {
  ShellDialogs,
  type ShellHost,
  ShellHostProvider,
  useDeviceTaskNotificationChannel,
} from "@ngriffin_uk/polychat-component-shell";
import { WEB_APP_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { type ReactNode, useMemo } from "react";

import { useDeepLinkNavigation } from "./hooks/useDeepLinkNavigation";
import { useInboxNotifier } from "./hooks/useInboxNotifier";
import { useWindowTitle } from "./hooks/useWindowTitle";

export function DesktopShellHost({
  children,
  onSignIn,
  onSignOut,
}: {
  children: ReactNode;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  useInboxNotifier();
  useDeepLinkNavigation();
  useWindowTitle();

  const setShowMetaAssistant = useUIStore((state) => state.setShowMetaAssistant);

  const host = useMemo<ShellHost>(
    () => ({
      webBaseUrl: WEB_APP_BASE_URL,
      openAssistant: () => setShowMetaAssistant(true),
      openSignIn: onSignIn,
      signOut: onSignOut,
      useTaskNotificationChannel: useDeviceTaskNotificationChannel,
      HostDialogs: ShellDialogs,
    }),
    [onSignIn, onSignOut, setShowMetaAssistant],
  );

  return <ShellHostProvider host={host}>{children}</ShellHostProvider>;
}
