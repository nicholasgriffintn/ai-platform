import {
  NO_STORE,
  updateUserSettingsResponseSchema,
  updateUserSettingsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineSingleton } from "~/infrastructure/http/resource";
import { handleExportChatHistory } from "~/modules/account/application/exportChatHistory";
import { updateUserSettings } from "~/modules/account/application/settings";

const app = new Hono();

defineSingleton(app, { tags: ["account"] }, (account) => {
  account.update({
    auth: true,
    summary: "Update account settings",
    bodySchema: updateUserSettingsSchema,
    responses: {
      200: { description: "Settings updated", schema: updateUserSettingsResponseSchema },
    },
    handler: ({ serviceContext, body, user }) => updateUserSettings(serviceContext, body, user.id),
  });
});

defineSingleton(app, { path: "/export", tags: ["account"] }, (exported) => {
  exported.read({
    auth: true,
    summary: "Export chat history",
    description: "Returns a JSON file containing the user's chat history.",
    responses: { 200: { description: "JSON file with chat history" } },
    handler: async ({ serviceContext, user }) => {
      const json = await handleExportChatHistory({
        context: serviceContext,
        env: serviceContext.env,
        user,
      });
      const filename = `chat-history-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      return new Response(JSON.stringify(json, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": NO_STORE,
        },
      });
    },
  });
});

export default app;
