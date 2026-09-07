import { useDeepLinkNavigation } from "./hooks/useDeepLinkNavigation";
import { useInboxNotifier } from "./hooks/useInboxNotifier";
import { useWindowTitle } from "./hooks/useWindowTitle";

export function DesktopWindowEffects() {
  useInboxNotifier();
  useDeepLinkNavigation();
  useWindowTitle();

  return null;
}
