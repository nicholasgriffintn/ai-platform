import z from "zod/v4";

import {
  agentRuntimeVendorSchema,
  agentToolStateSchema,
  modelRuntimeCapabilitiesSchema,
  modelRuntimeVendorSchema,
  desktopRuntimeReadinessSchema,
} from "./desktop-runtimes.js";

export const MACHINE_ONLINE_WINDOW_MS = 5 * 60_000;

export const machinePlatformSchema = z.enum(["macos", "windows", "linux"]);
export type MachinePlatform = z.infer<typeof machinePlatformSchema>;

export const machineCapabilitySchema = z.enum([
  "model-run",
  "agent-run",
  "handoff",
  "model-relay",
  "local-tools",
]);
export type MachineCapability = z.infer<typeof machineCapabilitySchema>;

export const machineDirectorySchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(120),
  })
  .strict();

export type MachineDirectory = z.infer<typeof machineDirectorySchema>;

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

export const machineAgentRuntimeSchema = z
  .object({
    kind: z.literal("agent"),
    vendor: agentRuntimeVendorSchema,
    readiness: agentToolStateSchema,
    supportsSessions: z.boolean(),
  })
  .strict();

export type MachineAgentRuntime = z.infer<typeof machineAgentRuntimeSchema>;

export const machineModelRuntimeSchema = z
  .object({
    kind: z.literal("model"),
    vendor: modelRuntimeVendorSchema,
    readiness: desktopRuntimeReadinessSchema,
    models: z.array(machineModelSchema).max(500),
  })
  .strict();

export const machineLocalToolsRuntimeSchema = z
  .object({
    kind: z.literal("local-tools"),
    directories: z.array(machineDirectorySchema).max(32),
  })
  .strict();

export type MachineLocalToolsRuntime = z.infer<typeof machineLocalToolsRuntimeSchema>;

export const machineRuntimeSchema = z.union([
  machineModelRuntimeSchema,
  machineAgentRuntimeSchema,
  machineLocalToolsRuntimeSchema,
]);
export type MachineRuntime = z.infer<typeof machineRuntimeSchema>;

export const machineHeartbeatSchema = z
  .object({
    machineId: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(120),
    platform: machinePlatformSchema,
    appVersion: z.string().trim().min(1).max(64),
    runtimes: z.array(machineRuntimeSchema).max(32),
    capabilities: z.array(machineCapabilitySchema).max(5),
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

export const DEVICE_ACTIVITY_SOURCES = ["browsing", "agents", "apps", "music", "games"] as const;
export const deviceActivitySourceSchema = z.enum(DEVICE_ACTIVITY_SOURCES);
export type DeviceActivitySource = z.infer<typeof deviceActivitySourceSchema>;
export const DEVICE_ACTIVITY_PROVIDER_PREFIX = "device_";
export const DEVICE_ACTIVITY_LINE_LIMIT = 40;
export const DEVICE_ACTIVITY_LINE_LENGTH = 280;
export const DEVICE_ACTIVITY_ITEM_LIMIT = 20;
export const DEVICE_ACTIVITY_ITEM_DETAIL_LENGTH = 1_500;

export const machineActivityItemSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    url: z
      .url({ protocol: /^https?$/u })
      .max(2048)
      .nullish(),
    detail: z.string().trim().min(1).max(DEVICE_ACTIVITY_ITEM_DETAIL_LENGTH).nullish(),
  })
  .strict();

export type MachineActivityItem = z.infer<typeof machineActivityItemSchema>;

export const machineActivitySourceSchema = z
  .object({
    source: deviceActivitySourceSchema,
    lines: z
      .array(z.string().trim().min(1).max(DEVICE_ACTIVITY_LINE_LENGTH))
      .max(DEVICE_ACTIVITY_LINE_LIMIT),
    items: z.array(machineActivityItemSchema).max(DEVICE_ACTIVITY_ITEM_LIMIT).optional(),
  })
  .strict();

export type MachineActivitySource = z.infer<typeof machineActivitySourceSchema>;

export const machineActivitySchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
    sources: z
      .array(machineActivitySourceSchema)
      .max(DEVICE_ACTIVITY_SOURCES.length)
      .refine((sources) => new Set(sources.map((item) => item.source)).size === sources.length, {
        error: "Send each source once",
      }),
  })
  .strict();

export type MachineActivity = z.infer<typeof machineActivitySchema>;

export const machineActivityResponseSchema = z
  .object({
    recorded: z.array(deviceActivitySourceSchema),
    excluded: z.array(deviceActivitySourceSchema),
  })
  .strict();

export type MachineActivityResponse = z.infer<typeof machineActivityResponseSchema>;
