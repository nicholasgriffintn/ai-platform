import {
  CLOUDFLARE_RATE_ENTRIES,
  CLOUDFLARE_VENDOR,
  CONTAINER_INSTANCE_TYPES,
  CONTAINER_RESOURCE,
  creditMicrosFromCostMicros,
  isContainerInstanceType,
  priceUsage,
  type ContainerInstanceType,
} from "@ngriffin_uk/polychat-schemas";

import type { InfraUsageQuantity } from "./infraUsage";

export const DEFAULT_CONTAINER_INSTANCE_TYPE: ContainerInstanceType = "basic";

export function resolveContainerInstanceType(value: unknown): ContainerInstanceType {
  return isContainerInstanceType(value) ? value : DEFAULT_CONTAINER_INSTANCE_TYPE;
}

export function containerSecondQuantities(
  instanceType: ContainerInstanceType,
  durationSeconds: number,
): InfraUsageQuantity[] {
  const spec = CONTAINER_INSTANCE_TYPES[instanceType];
  const seconds = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;

  return [
    { unit: "container_vcpu_seconds", quantity: seconds * spec.vcpu },
    { unit: "container_gib_seconds", quantity: seconds * spec.memoryGib },
    { unit: "container_disk_gb_seconds", quantity: seconds * spec.diskGb },
  ];
}

export function estimateContainerRunCreditMicros(
  instanceType: ContainerInstanceType,
  durationSeconds: number,
  occurredAt: string = new Date().toISOString(),
): number {
  let costMicros = 0;

  for (const entry of containerSecondQuantities(instanceType, durationSeconds)) {
    costMicros += priceUsage(
      CLOUDFLARE_RATE_ENTRIES,
      {
        vendor: CLOUDFLARE_VENDOR,
        resource: CONTAINER_RESOURCE,
        unit: entry.unit,
        occurredAt,
      },
      entry.quantity,
    ).costMicros;
  }

  return creditMicrosFromCostMicros(costMicros);
}
