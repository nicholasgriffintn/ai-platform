export type SurfaceAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: string };

export interface SurfaceAction<Input, Output = void> {
  readonly availability: SurfaceAvailability;
  run(input: Input): Promise<Output>;
}

export interface SurfaceShareRequest {
  title?: string;
  text?: string;
  url?: string;
}

export interface SurfaceFileSelectionRequest {
  accept?: readonly string[];
  multiple?: boolean;
}

export interface SurfaceNotification {
  kind: "info" | "success" | "warning" | "error";
  message: string;
}

export interface SurfaceStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SurfaceControls<NavigationIntent, SelectedFile = unknown> {
  navigate: SurfaceAction<NavigationIntent>;
  openExternal: SurfaceAction<string>;
  copyText: SurfaceAction<string>;
  share: SurfaceAction<SurfaceShareRequest>;
  selectFiles: SurfaceAction<SurfaceFileSelectionRequest, readonly SelectedFile[]>;
  notify: SurfaceAction<SurfaceNotification>;
  storage: SurfaceStorage;
}

export class SurfaceCapabilityUnavailableError extends Error {
  readonly capability: string;

  constructor(capability: string, reason: string) {
    super(`${capability} is unavailable: ${reason}`);
    this.name = "SurfaceCapabilityUnavailableError";
    this.capability = capability;
  }
}

export function createSurfaceAction<Input, Output = void>(
  run: (input: Input) => Promise<Output> | Output,
): SurfaceAction<Input, Output> {
  return {
    availability: { status: "available" },
    run: async (input) => run(input),
  };
}

export function createUnavailableSurfaceAction<Input, Output = void>(
  capability: string,
  reason: string,
): SurfaceAction<Input, Output> {
  return {
    availability: { status: "unavailable", reason },
    run: async () => {
      throw new SurfaceCapabilityUnavailableError(capability, reason);
    },
  };
}

export function createMemorySurfaceStorage(
  initialValues: Readonly<Record<string, string>> = {},
): SurfaceStorage {
  const values = new Map(Object.entries(initialValues));

  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

export interface SurfaceAnalyticsEvent {
  name: string;
  category?: string;
  label?: string;
  value?: string | number;
  properties?: Record<string, string | number | boolean | undefined>;
}

/**
 * Reporting is a host concern: render modules describe what happened and the application decides
 * where it goes. Implementations must never throw into the render path.
 */
export interface SurfaceAnalytics {
  track(event: SurfaceAnalyticsEvent): void;
}

export const noopSurfaceAnalytics: SurfaceAnalytics = {
  track: () => undefined,
};
