import z from "zod/v4";

import {
  modelRuntimeCapabilitiesSchema,
  modelRuntimeVendorSchema,
  desktopRuntimeReadinessSchema,
} from "./desktop-runtimes.js";

export const MACHINE_ONLINE_WINDOW_MS = 5 * 60_000;

export const machinePlatformSchema = z.enum(["macos", "windows", "linux"]);
export type MachinePlatform = z.infer<typeof machinePlatformSchema>;

export const machineCapabilitySchema = z.enum(["model-run", "agent-run", "handoff", "model-relay"]);
export type MachineCapability = z.infer<typeof machineCapabilitySchema>;

export const machineModelSchema = z
  .object({
    nativeId: z.string().trim().min(1).max(256),
    displayName: z.string().trim().min(1).max(200),
    contextTokens: z.number().int().positive().nullable(),
    parameterSizeBytes: z.number().int().positive().nullable().optional(),
    capabilities: modelRuntimeCapabilitiesSchema,
    loaded: z.boolean(),
  })
  .strict();

export type MachineModel = z.infer<typeof machineModelSchema>;

export const machineModelRuntimeSchema = z
  .object({
    kind: z.literal("model"),
    vendor: modelRuntimeVendorSchema,
    readiness: desktopRuntimeReadinessSchema,
    models: z.array(machineModelSchema).max(500),
  })
  .strict();

export const machineRuntimeSchema = machineModelRuntimeSchema;
export type MachineRuntime = z.infer<typeof machineRuntimeSchema>;

export const machineHeartbeatSchema = z
  .object({
    machineId: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(120),
    platform: machinePlatformSchema,
    appVersion: z.string().trim().min(1).max(64),
    runtimes: z.array(machineRuntimeSchema).max(32),
    capabilities: z.array(machineCapabilitySchema).max(4),
  })
  .strict();

export type MachineHeartbeat = z.infer<typeof machineHeartbeatSchema>;

export const machineRecordSchema = z
  .object({
    ...machineHeartbeatSchema.shape,
    lastSeenAt: z.string(),
    online: z.boolean(),
  })
  .strict();

export type MachineRecord = z.infer<typeof machineRecordSchema>;

export const machineListResponseSchema = z.array(machineRecordSchema);
export const machineForgetResponseSchema = z.object({ forgotten: z.boolean() }).strict();

export function isMachineOnline(
  machine: Pick<MachineRecord, "lastSeenAt">,
  now = Date.now(),
): boolean {
  const lastSeenAt = Date.parse(machine.lastSeenAt);

  return Number.isFinite(lastSeenAt) && now - lastSeenAt < MACHINE_ONLINE_WINDOW_MS;
}
