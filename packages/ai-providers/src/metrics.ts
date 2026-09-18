import type { ProviderEnv } from "./env.js";
import type { ProviderHost } from "./host.js";

export interface TrackProviderMetricsOptions<T> {
  provider: string;
  model: string;
  operation: () => Promise<T>;
  settings?: Record<string, unknown>;
  userId?: number;
  completion_id?: string;
  env?: ProviderEnv;
  request?: { env?: ProviderEnv } & Record<string, unknown>;
}

export function trackProviderMetrics<T>(
  host: ProviderHost,
  { operation, ...metrics }: TrackProviderMetricsOptions<T>,
): Promise<T> {
  if (!host.metrics) {
    return operation();
  }

  return host.metrics.trackProviderOperation(
    { ...metrics, env: metrics.env ?? metrics.request?.env },
    operation,
  );
}
