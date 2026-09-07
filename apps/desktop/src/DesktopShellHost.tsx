import { type ShellHost, ShellHostProvider } from "@ngriffin_uk/polychat-component-shell";
import { WEB_APP_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { type ReactNode, useMemo } from "react";

import { useDeepLinkNavigation } from "./hooks/useDeepLinkNavigation";
import { useInboxNotifier } from "./hooks/useInboxNotifier";
import { unavailableOnDesktop } from "./lib/host-features";

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

  const host = useMemo<ShellHost>(
    () => ({
      webBaseUrl: WEB_APP_BASE_URL,
      openAssistant: unavailableOnDesktop("Ask Poly"),
      openSignIn: onSignIn,
      signOut: onSignOut,
    }),
    [onSignIn, onSignOut],
  );

  return <ShellHostProvider host={host}>{children}</ShellHostProvider>;
}
