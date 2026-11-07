import { machineRunClient, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect, useRef } from "react";

import { tauriDesktopBackend } from "../infrastructure/desktop-backend";
import {
  advertiseCurrentMachine,
  createMachineHeartbeatScheduler,
  removeMachineAdvertisement,
} from "../infrastructure/machine-heartbeat";
import { MACHINE_ENDPOINTS_CHANGED_EVENT } from "../infrastructure/machine-heartbeat-events";
import { runMachineConsumer } from "../infrastructure/machine-runner";

export function useMachineHeartbeat(): void {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const hasHydratedUserConfiguration = useChatStore((state) => state.hasHydratedUserConfiguration);
  const advertiseMachines = useChatStore(
    (state) => state.userSettings?.advertise_machines !== false,
  );

  const lastHeartbeat = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!isAuthenticated || !hasHydratedUserConfiguration) {
      return undefined;
    }

    if (!advertiseMachines) {
      void lastHeartbeat.current
        .catch(() => undefined)
        .then(removeMachineAdvertisement)
        .catch(() => undefined);

      return undefined;
    }

    const controller = new AbortController();
    let consumerStarted = false;
    const heartbeat = async () => {
      const advertised = advertiseCurrentMachine();

      lastHeartbeat.current = advertised;

      const machine = await advertised;

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
