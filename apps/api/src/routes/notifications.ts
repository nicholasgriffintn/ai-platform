import {
  projectTaskAttentionResponseSchema,
  registerTaskNotificationSchema,
  successResponseSchema,
  taskInboxMutationResponseSchema,
  taskInboxReceiptInputSchema,
  taskNotificationDeepLinkSchema,
  taskNotificationRegistrationResponseSchema,
  taskNotificationSettingsSchema,
  updateTaskNotificationPreferencesSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  getTaskNotificationSettings,
  listProjectTaskAttention,
  registerTaskNotification,
  removeTaskNotificationRegistration,
  resolveTaskNotificationDeepLink,
  updateTaskInboxReceipts,
  updateTaskNotificationPreferences,
} from "~/services/project-tasks/attention";

const app = new Hono();
const inboxQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() });

addRoute(app, "get", "/inbox", {
  auth: true,
  tags: ["notifications", "tasks"],
  summary: "List current task attention",
  querySchema: inboxQuery,
  responses: {
    200: { description: "Current task inbox", schema: projectTaskAttentionResponseSchema },
  },
  handler: ({ serviceContext, query }) =>
    listProjectTaskAttention(serviceContext, { limit: query.limit }),
});

addRoute(app, "post", "/inbox/read", {
  auth: true,
  tags: ["notifications", "tasks"],
  summary: "Mark task inbox items read",
  bodySchema: taskInboxReceiptInputSchema,
  responses: {
    200: { description: "Updated receipts", schema: taskInboxMutationResponseSchema },
  },
  handler: ({ serviceContext, body }) =>
    updateTaskInboxReceipts(serviceContext, body.itemIds, "read"),
});

addRoute(app, "post", "/inbox/dismiss", {
  auth: true,
  tags: ["notifications", "tasks"],
  summary: "Dismiss task inbox items",
  bodySchema: taskInboxReceiptInputSchema,
  responses: {
    200: { description: "Updated receipts", schema: taskInboxMutationResponseSchema },
  },
  handler: ({ serviceContext, body }) =>
    updateTaskInboxReceipts(serviceContext, body.itemIds, "dismiss"),
});

addRoute(app, "get", "/inbox/:itemId", {
  auth: true,
  tags: ["notifications", "tasks"],
  summary: "Resolve a current task notification link",
  paramSchema: z.object({ itemId: z.string().min(1).max(256) }),
  responses: {
    200: { description: "Current deep-link state", schema: taskNotificationDeepLinkSchema },
  },
  handler: ({ serviceContext, params }) =>
    resolveTaskNotificationDeepLink(serviceContext, params.itemId),
});

addRoute(app, "get", "/settings", {
  auth: true,
  tags: ["notifications"],
  summary: "Get task notification settings",
  responses: {
    200: { description: "Task notification settings", schema: taskNotificationSettingsSchema },
  },
  handler: ({ serviceContext }) => getTaskNotificationSettings(serviceContext),
});

addRoute(app, "put", "/settings", {
  auth: true,
  tags: ["notifications"],
  summary: "Update task notification preferences",
  bodySchema: updateTaskNotificationPreferencesSchema,
  responses: {
    200: {
      description: "Updated task notification settings",
      schema: taskNotificationSettingsSchema,
    },
  },
  handler: ({ serviceContext, body }) => updateTaskNotificationPreferences(serviceContext, body),
});

addRoute(app, "post", "/registrations", {
  auth: true,
  tags: ["notifications"],
  summary: "Register a notification installation",
  bodySchema: registerTaskNotificationSchema,
  responses: {
    200: {
      description: "Registered notification installation",
      schema: taskNotificationRegistrationResponseSchema,
    },
  },
  handler: ({ serviceContext, body }) => registerTaskNotification(serviceContext, body),
});

addRoute(app, "delete", "/registrations/:installationId", {
  auth: true,
  tags: ["notifications"],
  summary: "Remove a notification installation",
  paramSchema: z.object({ installationId: z.string().min(1).max(128) }),
  responses: {
    200: { description: "Registration removed", schema: successResponseSchema },
  },
  handler: ({ serviceContext, params }) =>
    removeTaskNotificationRegistration(serviceContext, params.installationId),
});

export default app;
