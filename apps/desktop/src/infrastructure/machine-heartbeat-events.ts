export const MACHINE_ENDPOINTS_CHANGED_EVENT = "polychat:machine-endpoints-changed";

export function notifyMachineEndpointsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MACHINE_ENDPOINTS_CHANGED_EVENT));
  }
}
