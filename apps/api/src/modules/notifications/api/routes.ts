import {
  projectTaskAttentionResponseSchema,
  registerTaskNotificationSchema,
  taskInboxMutationResponseSchema,
  taskInboxReceiptInputSchema,
  taskNotificationDeepLinkSchema,
  taskNotificationRegistrationResponseSchema,
  taskNotificationSettingsSchema,
  updateTaskNotificationPreferencesSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource, defineSingleton } from "~/infrastructure/http/resource";
import {
  getTaskNotificationSettings,
  listProjectTaskAttention,
  registerTaskNotification,
  removeTaskNotificationRegistration,
  resolveTaskNotificationDeepLink,
  updateTaskInboxReceipts,
  updateTaskNotificationPreferences,
} from "~/modules/project-tasks/application/attention";

const app = new Hono();
const inboxQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() });
const notificationParamsSchema = z.object({ notification_id: z.string().min(1).max(256) });
const registrationParamsSchema = z.object({ registration_id: z.string().min(1).max(128) });

defineResource(app, { idParam: "notification_id", tags: ["notifications"] }, (notifications) => {
  notifications
    .list({
      auth: true,
      summary: "List the task inbox",
      description: "Current task attention, unread first. The unread count covers the whole inbox.",
      querySchema: inboxQuerySchema,
      responses: {
        200: { description: "Task inbox", schema: projectTaskAttentionResponseSchema },
      },
      handler: ({ serviceContext, query }) =>
        listProjectTaskAttention(serviceContext, { limit: query.limit }),
    })
    .collectionAction("read", {
      auth: true,
      summary: "Mark inbox items read",
      bodySchema: taskInboxReceiptInputSchema,
      responses: { 200: { description: "Receipts", schema: taskInboxMutationResponseSchema } },
      handler: ({ serviceContext, body }) =>
        updateTaskInboxReceipts(serviceContext, body.itemIds, "read"),
    })
    .collectionAction("dismiss", {
      auth: true,
      summary: "Dismiss inbox items",
      bodySchema: taskInboxReceiptInputSchema,
      responses: { 200: { description: "Receipts", schema: taskInboxMutationResponseSchema } },
      handler: ({ serviceContext, body }) =>
        updateTaskInboxReceipts(serviceContext, body.itemIds, "dismiss"),
    })
    .read({
      auth: true,
      summary: "Resolve a notification's current link",
      paramSchema: notificationParamsSchema,
      responses: {
        200: { description: "Current deep-link state", schema: taskNotificationDeepLinkSchema },
      },
      handler: ({ serviceContext, params }) =>
        resolveTaskNotificationDeepLink(serviceContext, params.notification_id),
    });

  notifications
    .collection("registrations", "registration_id")
    .create({
      auth: true,
      summary: "Register a notification installation",
      bodySchema: registerTaskNotificationSchema,
      responses: {
        200: { description: "Registration", schema: taskNotificationRegistrationResponseSchema },
      },
      handler: ({ serviceContext, body }) => registerTaskNotification(serviceContext, body),
    })
    .delete({
      auth: true,
      summary: "Remove a notification installation",
      description: "The registration id is the installation id it registered with.",
      paramSchema: registrationParamsSchema,
      handler: async ({ serviceContext, params }) => {
        await removeTaskNotificationRegistration(serviceContext, params.registration_id);

        return { deleted: true };
      },
    });
});

defineSingleton(app, { path: "/settings", tags: ["notifications"] }, (settings) => {
  settings
    .read({
      auth: true,
      summary: "Get notification settings",
      responses: { 200: { description: "Settings", schema: taskNotificationSettingsSchema } },
      handler: ({ serviceContext }) => getTaskNotificationSettings(serviceContext),
    })
    .update({
      auth: true,
      summary: "Update notification preferences",
      bodySchema: updateTaskNotificationPreferencesSchema,
      responses: { 200: { description: "Settings", schema: taskNotificationSettingsSchema } },
      handler: ({ serviceContext, body }) =>
        updateTaskNotificationPreferences(serviceContext, body),
    });
});

export default app;
