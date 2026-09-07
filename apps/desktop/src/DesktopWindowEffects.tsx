import { useDeepLinkNavigation } from "./hooks/useDeepLinkNavigation";
import { useInboxNotifier } from "./hooks/useInboxNotifier";
import { useMachineHeartbeat } from "./hooks/useMachineHeartbeat";
import { useWindowTitle } from "./hooks/useWindowTitle";

export function DesktopWindowEffects() {
  useInboxNotifier();
  useDeepLinkNavigation();
  useMachineHeartbeat();
  useWindowTitle();

  return null;
}
