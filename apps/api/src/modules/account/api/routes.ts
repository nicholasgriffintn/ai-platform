import {
  NO_STORE,
  updateUserSettingsResponseSchema,
  updateUserSettingsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineSingleton } from "~/infrastructure/http/resource";
import { streamAccountExport } from "~/modules/account/application/exportAccountData";
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
    summary: "Export account data",
    description:
      "Returns a ZIP archive of what the signed-in person made: conversations, memory, sources, outputs and their files, with a manifest of anything left out.",
    responses: { 200: { description: "ZIP archive of the person's data" } },
    handler: async ({ serviceContext, user }) => {
      const filename = `polychat-export-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

      return new Response(streamAccountExport(serviceContext, user), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": NO_STORE,
        },
      });
    },
  });
});

export default app;
