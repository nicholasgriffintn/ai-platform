import { useDeepLinkNavigation } from "./hooks/useDeepLinkNavigation";
import { useInboxNotifier } from "./hooks/useInboxNotifier";
import { useMachineHeartbeat } from "./hooks/useMachineHeartbeat";
import { usePolyDesktopBridge } from "./hooks/usePolyDesktopBridge";
import { useWindowTitle } from "./hooks/useWindowTitle";

export function DesktopWindowEffects() {
  useInboxNotifier();
  useDeepLinkNavigation();
  useMachineHeartbeat();
  usePolyDesktopBridge();
  useWindowTitle();

  return null;
}
