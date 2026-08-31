import type { RateEntry } from "./rates";

export const CLOUDFLARE_VENDOR = "cloudflare";

export const CLOUDFLARE_RATES_EFFECTIVE_FROM = "2026-08-31";

const MILLION = 1e6;
const HUNDRED_MILLION = 1e8;

function usdToMicros(usd: number): number {
  return usd * 1e6;
}

function cloudflareRate(resource: string, unit: RateEntry["unit"], usdPerUnit: number): RateEntry {
  return {
    vendor: CLOUDFLARE_VENDOR,
    resource,
    unit,
    perUnitMicros: usdToMicros(usdPerUnit),
    effectiveFrom: CLOUDFLARE_RATES_EFFECTIVE_FROM,
  };
}

export const CLOUDFLARE_RATE_ENTRIES: readonly RateEntry[] = [
  cloudflareRate("containers", "container_vcpu_seconds", 0.00002),
  cloudflareRate("containers", "container_gib_seconds", 0.0000025),
  cloudflareRate("containers", "container_disk_gb_seconds", 0.00000007),
  cloudflareRate("containers", "container_egress_gb", 0.025),
  cloudflareRate("durable_objects", "do_requests", 0.15 / MILLION),
  cloudflareRate("durable_objects", "do_gb_seconds", 12.5 / MILLION),
  cloudflareRate("durable_objects", "do_rows_read", 0.001 / MILLION),
  cloudflareRate("durable_objects", "do_rows_written", 1.0 / MILLION),
  cloudflareRate("d1", "d1_rows_read", 0.001 / MILLION),
  cloudflareRate("d1", "d1_rows_written", 1.0 / MILLION),
  cloudflareRate("workers", "worker_requests", 0.3 / MILLION),
  cloudflareRate("workers", "worker_cpu_ms", 0.02 / MILLION),
  cloudflareRate("vectorize", "vectorize_queried_dimensions", 0.01 / MILLION),
  cloudflareRate("vectorize", "vectorize_stored_dimensions", 0.05 / HUNDRED_MILLION),
  cloudflareRate("queues", "queue_operations", 0.4 / MILLION),
  cloudflareRate("workers_ai", "ai_neurons", 0.011 / 1000),
  cloudflareRate("analytics_engine", "analytics_data_points", 0.25 / MILLION),
  cloudflareRate("r2", "r2_class_a_ops", 4.5 / MILLION),
  cloudflareRate("r2", "r2_class_b_ops", 0.36 / MILLION),
];

export type ContainerInstanceSpec = {
  vcpu: number;
  memoryGib: number;
  diskGb: number;
};

export const CONTAINER_INSTANCE_TYPES = {
  lite: { vcpu: 0.0625, memoryGib: 0.25, diskGb: 2 },
  basic: { vcpu: 0.25, memoryGib: 1, diskGb: 4 },
  "standard-1": { vcpu: 0.5, memoryGib: 4, diskGb: 8 },
  "standard-2": { vcpu: 1, memoryGib: 6, diskGb: 12 },
  "standard-3": { vcpu: 2, memoryGib: 8, diskGb: 16 },
  "standard-4": { vcpu: 4, memoryGib: 12, diskGb: 20 },
} as const satisfies Record<string, ContainerInstanceSpec>;

export type ContainerInstanceType = keyof typeof CONTAINER_INSTANCE_TYPES;

export const CONTAINER_RESOURCE = "containers";

export function isContainerInstanceType(value: unknown): value is ContainerInstanceType {
  return typeof value === "string" && value in CONTAINER_INSTANCE_TYPES;
}
