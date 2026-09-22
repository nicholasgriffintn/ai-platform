import { desktopExecutionBackend } from "@ngriffin_uk/polychat-library-chat";
import { useMachines } from "@ngriffin_uk/polychat-library-react";
import { isMachineOnline, type MachineCapability } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useAvailableLocalMachines(capability: MachineCapability) {
  const machines = useMachines();
  const getMachineId = desktopExecutionBackend()?.getMachineId;
  const currentMachine = useQuery({
    queryKey: ["desktop", "machine-id"],
    queryFn: () => getMachineId?.() ?? Promise.resolve(null),
    enabled: Boolean(getMachineId),
    staleTime: Infinity,
  });
  const available = useMemo(
    () =>
      (machines.data ?? []).filter(
        (machine) =>
          machine.online && isMachineOnline(machine) && machine.capabilities.includes(capability),
      ),
    [capability, machines.data],
  );

  return { available, currentMachineId: currentMachine.data ?? null };
}
