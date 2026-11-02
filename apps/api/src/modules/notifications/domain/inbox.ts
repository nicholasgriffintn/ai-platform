import { internalNavigationPathSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

export const inboxNotificationSchema = z.object({
  source: z.string().min(1),
  title: z.string().min(1).max(160),
  body: z.string().max(1000),
  deepLink: internalNavigationPathSchema,
  expiresAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable().default(null),
  dismissedAt: z.iso.datetime().nullable().default(null),
  dispatchedAt: z.iso.datetime().nullable().default(null),
  payload: z.record(z.string(), z.unknown()),
});

export type InboxNotification = z.infer<typeof inboxNotificationSchema>;
