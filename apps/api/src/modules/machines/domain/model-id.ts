const MACHINE_MODEL_PREFIX = "machine/";

export interface MachineModelReference {
  machineId: string;
  vendor: string;
  nativeId: string;
}

export function machineModelId({ machineId, vendor, nativeId }: MachineModelReference): string {
  return `${MACHINE_MODEL_PREFIX}${machineId}/${vendor}/${nativeId}`;
}

export function isMachineModelId(modelId: string | null | undefined): boolean {
  return Boolean(modelId?.startsWith(MACHINE_MODEL_PREFIX));
}

export function parseMachineModelId(modelId: string): MachineModelReference | null {
  if (!isMachineModelId(modelId)) {
    return null;
  }

  const [machineId, vendor, ...nativeIdParts] = modelId
    .slice(MACHINE_MODEL_PREFIX.length)
    .split("/");
  const nativeId = nativeIdParts.join("/");

  return machineId && vendor && nativeId ? { machineId, vendor, nativeId } : null;
}
