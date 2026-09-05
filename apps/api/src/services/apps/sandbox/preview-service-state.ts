import type { SandboxRunEvent, SandboxServiceStatus } from "@ngriffin_uk/polychat-schemas";

export interface PreviewServiceState {
  port?: number;
  status: SandboxServiceStatus;
}

export function resolvePreviewServiceState(
  events: readonly SandboxRunEvent[],
  serviceName: string,
): PreviewServiceState | null {
  let state: PreviewServiceState | null = null;

  for (const event of events) {
    if (event.serviceName !== serviceName) {
      continue;
    }

    state = {
      port: event.servicePort ?? state?.port,
      status: event.serviceStatus ?? state?.status ?? "stopped",
    };
  }

  return state;
}
