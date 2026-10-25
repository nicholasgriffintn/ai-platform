import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";

import {
  DEVICE_ACTIVITY_INTERVAL_MS,
  onDeviceActivityChanged,
  shareDeviceActivity,
} from "../infrastructure/device-activity";
import { createMachineHeartbeatScheduler } from "../infrastructure/machine-heartbeat";

export function useDeviceActivitySharing(): void {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const scheduler = createMachineHeartbeatScheduler({
      heartbeat: shareDeviceActivity,
      intervalMs: DEVICE_ACTIVITY_INTERVAL_MS,
    });
    const stopListening = onDeviceActivityChanged(() => scheduler.trigger());

    scheduler.start();

    return () => {
      stopListening();
      scheduler.stop();
    };
  }, [isAuthenticated]);
}
