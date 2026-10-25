import { useDeepLinkNavigation } from "./hooks/useDeepLinkNavigation";
import { useDeviceActivitySharing } from "./hooks/useDeviceActivitySharing";
import { useInboxNotifier } from "./hooks/useInboxNotifier";
import { useMachineHeartbeat } from "./hooks/useMachineHeartbeat";
import { usePolyDesktopBridge } from "./hooks/usePolyDesktopBridge";
import { useWindowTitle } from "./hooks/useWindowTitle";

export function DesktopWindowEffects() {
  useInboxNotifier();
  useDeepLinkNavigation();
  useMachineHeartbeat();
  useDeviceActivitySharing();
  usePolyDesktopBridge();
  useWindowTitle();

  return null;
}
