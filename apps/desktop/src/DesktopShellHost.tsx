import {
  DeviceTaskNotificationSettings,
  ShellDialogs,
  type ShellHost,
  ShellHostProvider,
} from "@ngriffin_uk/polychat-component-shell";
import { WEB_APP_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { type ReactNode, useMemo } from "react";

export function DesktopShellHost({
  children,
  onSignIn,
  onSignOut,
}: {
  children: ReactNode;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const setShowMetaAssistant = useUIStore((state) => state.setShowMetaAssistant);

  const host = useMemo<ShellHost>(
    () => ({
      webBaseUrl: WEB_APP_BASE_URL,
      openAssistant: () => setShowMetaAssistant(true),
      openSignIn: onSignIn,
      signOut: onSignOut,
      TaskNotificationSettings: DeviceTaskNotificationSettings,
      HostDialogs: ShellDialogs,
    }),
    [onSignIn, onSignOut, setShowMetaAssistant],
  );

  return <ShellHostProvider host={host}>{children}</ShellHostProvider>;
}
