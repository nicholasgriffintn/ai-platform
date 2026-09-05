import z from "zod/v4";

export const TASK_NOTIFICATION_PROTOCOL_VERSION = 1;

export const taskNotificationCategorySchema = z.enum([
  "decisions",
  "failures",
  "completions",
  "assignments",
]);

export type TaskNotificationCategory = z.infer<typeof taskNotificationCategorySchema>;

export const taskNotificationPreferencesSchema = z.object({
  enabled: z.boolean(),
  decisions: z.boolean(),
  failures: z.boolean(),
  completions: z.boolean(),
  assignments: z.boolean(),
});

export type TaskNotificationPreferences = z.infer<typeof taskNotificationPreferencesSchema>;

export const updateTaskNotificationPreferencesSchema = taskNotificationPreferencesSchema.partial();

export type UpdateTaskNotificationPreferences = z.infer<
  typeof updateTaskNotificationPreferencesSchema
>;

export const notificationPermissionSchema = z.enum(["prompt", "granted", "denied", "unsupported"]);

export type NotificationPermission = z.infer<typeof notificationPermissionSchema>;

export const taskNotificationRegistrationStateSchema = z.enum(["registered", "failed", "disabled"]);

export const taskNotificationPlatformSchema = z.literal("web");
export type TaskNotificationPlatform = z.infer<typeof taskNotificationPlatformSchema>;

const registrationFields = {
  installationId: z.string().trim().min(1).max(128),
};

export const registerTaskNotificationSchema = z.object({
  ...registrationFields,
  platform: z.literal("web"),
  subscription: z.object({
    endpoint: z.url().max(2048),
    expirationTime: z.number().nonnegative().nullable().default(null),
    keys: z.object({
      p256dh: z.string().trim().min(1).max(1024),
      auth: z.string().trim().min(1).max(1024),
    }),
  }),
});

export type RegisterTaskNotification = z.infer<typeof registerTaskNotificationSchema>;

export const taskNotificationRegistrationSchema = z.object({
  id: z.string().min(1),
  installationId: z.string().min(1),
  platform: taskNotificationPlatformSchema,
  state: taskNotificationRegistrationStateSchema,
  failureCode: z.string().nullable(),
  updatedAt: z.string(),
});

export type TaskNotificationRegistration = z.infer<typeof taskNotificationRegistrationSchema>;

export const taskNotificationSettingsSchema = z.object({
  protocolVersion: z.literal(TASK_NOTIFICATION_PROTOCOL_VERSION),
  preferences: taskNotificationPreferencesSchema,
  registrations: z.array(taskNotificationRegistrationSchema),
  webPushPublicKey: z.string().nullable(),
});

export type TaskNotificationSettings = z.infer<typeof taskNotificationSettingsSchema>;

export const taskNotificationRegistrationResponseSchema = z.object({
  registration: taskNotificationRegistrationSchema,
});

export const taskInboxReceiptInputSchema = z.object({
  itemIds: z.array(z.string().min(1).max(256)).min(1).max(100),
});

export const taskInboxMutationResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
});

export const taskNotificationDeepLinkSchema = z.object({
  protocolVersion: z.literal(TASK_NOTIFICATION_PROTOCOL_VERSION),
  itemId: z.string().min(1),
  current: z.boolean(),
  deepLink: z.string().nullable(),
});

export type TaskNotificationDeepLink = z.infer<typeof taskNotificationDeepLinkSchema>;

export function createTaskInboxItemId(taskId: string, taskVersion: number): string {
  return `${taskId}:v${taskVersion}`;
}

export function parseTaskInboxItemId(
  itemId: string,
): { taskId: string; taskVersion: number } | null {
  const match = /^(.+):v([1-9]\d*)$/.exec(itemId);

  if (!match) {
    return null;
  }

  const taskVersion = Number(match[2]);

  return Number.isSafeInteger(taskVersion) ? { taskId: match[1], taskVersion } : null;
}
