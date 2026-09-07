import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";

import {
  advertiseCurrentMachine,
  createMachineHeartbeatScheduler,
  removeMachineAdvertisement,
} from "../lib/machine-heartbeat";
import { MACHINE_ENDPOINTS_CHANGED_EVENT } from "../lib/machine-heartbeat-events";

export function useMachineHeartbeat(): void {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const hasHydratedUserConfiguration = useChatStore((state) => state.hasHydratedUserConfiguration);
  const advertiseMachines = useChatStore(
    (state) => state.userSettings?.advertise_machines !== false,
  );

  useEffect(() => {
    if (!isAuthenticated || !hasHydratedUserConfiguration) {
      return;
    }

    if (!advertiseMachines) {
      void removeMachineAdvertisement().catch(() => undefined);

      return;
    }

    const scheduler = createMachineHeartbeatScheduler({
      heartbeat: advertiseCurrentMachine,
    });
    const handleEndpointsChanged = () => scheduler.trigger();

    scheduler.start();
    window.addEventListener(MACHINE_ENDPOINTS_CHANGED_EVENT, handleEndpointsChanged);

    return () => {
      scheduler.stop();
      window.removeEventListener(MACHINE_ENDPOINTS_CHANGED_EVENT, handleEndpointsChanged);
    };
  }, [advertiseMachines, hasHydratedUserConfiguration, isAuthenticated]);
}
