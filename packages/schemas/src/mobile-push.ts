import z from "zod/v4";

export const mobilePushEnvironmentSchema = z.enum(["sandbox", "production"]);

export const registerMobilePushDeviceSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{32,256}$/),
  environment: mobilePushEnvironmentSchema,
  appBundleId: z.string().trim().min(3).max(200),
});

export const unregisterMobilePushDeviceSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{32,256}$/),
});

export const mobileWorkNotificationKindSchema = z.enum([
  "assigned",
  "input",
  "approval",
  "review",
  "completed",
  "failed",
]);

export const mobileWorkNotificationTargetSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  conversationId: z.string().nullable(),
  taskId: z.string().nullable(),
  runId: z.string().nullable(),
  interactionId: z.string().nullable(),
});

export const mobileWorkNotificationSchema = z.object({
  id: z.string(),
  kind: mobileWorkNotificationKindSchema,
  title: z.string().max(80),
  body: z.string().max(160),
  target: mobileWorkNotificationTargetSchema,
});

export type RegisterMobilePushDevice = z.infer<typeof registerMobilePushDeviceSchema>;
export type MobileWorkNotificationKind = z.infer<typeof mobileWorkNotificationKindSchema>;
export type MobileWorkNotificationTarget = z.infer<typeof mobileWorkNotificationTargetSchema>;
export type MobileWorkNotification = z.infer<typeof mobileWorkNotificationSchema>;
