import {
  SANDBOX_REMOTE_EXECUTION_PROVIDERS,
  sandboxRemoteExecutionProviderSchema,
  type SandboxExecutionProvider,
  type SandboxRemoteExecutionProvider,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo, useState } from "react";

import { useAvailableLocalMachines } from "../useAvailableLocalMachines.js";

export function useProjectCodingExecution(remoteProvider: SandboxRemoteExecutionProvider) {
  const [chosen, setChosen] = useState<string | null>(null);
  const { available: localMachines, currentMachineId } = useAvailableLocalMachines("sandbox");
  const preferredMachine = localMachines.find((machine) => machine.machineId === currentMachineId);
  const options = useMemo(
    () => [
      ...localMachines.map((machine) => ({
        value: `local:${machine.machineId}`,
        label:
          machine.machineId === currentMachineId
            ? "This device (Docker)"
            : `${machine.label} (Docker)`,
      })),
      ...SANDBOX_REMOTE_EXECUTION_PROVIDERS.map((provider) => ({
        value: provider.id,
        label: provider.label,
      })),
    ],
    [currentMachineId, localMachines],
  );
  const preferred = preferredMachine ? `local:${preferredMachine.machineId}` : remoteProvider;
  const selection =
    chosen && options.some((option) => option.value === chosen) ? chosen : preferred;
  const localMachine = localMachines.find((machine) => `local:${machine.machineId}` === selection);
  const selectedRemote = sandboxRemoteExecutionProviderSchema.safeParse(selection);
  const executionProvider: SandboxExecutionProvider = localMachine
    ? "local"
    : selectedRemote.success
      ? selectedRemote.data
      : remoteProvider;

  return useMemo(
    () => ({
      selection,
      options,
      executionProvider,
      machineId: localMachine?.machineId,
      onChange: setChosen,
    }),
    [selection, options, executionProvider, localMachine?.machineId],
  );
}
