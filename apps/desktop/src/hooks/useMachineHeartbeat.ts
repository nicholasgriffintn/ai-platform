import { machineRunClient, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";

import { tauriDesktopBackend } from "../lib/desktop-backend";
import {
  advertiseCurrentMachine,
  createMachineHeartbeatScheduler,
  removeMachineAdvertisement,
} from "../lib/machine-heartbeat";
import { MACHINE_ENDPOINTS_CHANGED_EVENT } from "../lib/machine-heartbeat-events";
import { runMachineConsumer } from "../lib/machine-runner";

export function useMachineHeartbeat(): void {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const hasHydratedUserConfiguration = useChatStore((state) => state.hasHydratedUserConfiguration);
  const advertiseMachines = useChatStore(
    (state) => state.userSettings?.advertise_machines !== false,
  );

  useEffect(() => {
    if (!isAuthenticated || !hasHydratedUserConfiguration) {
      return undefined;
    }

    if (!advertiseMachines) {
      void removeMachineAdvertisement().catch(() => undefined);

      return undefined;
    }

    const controller = new AbortController();
    let consumerStarted = false;
    const heartbeat = async () => {
      const machine = await advertiseCurrentMachine();

      if (machine && !consumerStarted && !controller.signal.aborted) {
        consumerStarted = true;
        void runMachineConsumer({
          backend: tauriDesktopBackend,
          client: machineRunClient,
          machineId: machine.machineId,
          signal: controller.signal,
        });
      }
    };

    const scheduler = createMachineHeartbeatScheduler({
      heartbeat,
    });
    const handleEndpointsChanged = () => scheduler.trigger();

    scheduler.start();
    window.addEventListener(MACHINE_ENDPOINTS_CHANGED_EVENT, handleEndpointsChanged);

    return () => {
      controller.abort();
      scheduler.stop();
      window.removeEventListener(MACHINE_ENDPOINTS_CHANGED_EVENT, handleEndpointsChanged);
    };
  }, [advertiseMachines, hasHydratedUserConfiguration, isAuthenticated]);
}
