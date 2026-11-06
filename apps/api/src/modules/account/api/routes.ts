import {
  accountExportFilesQuerySchema,
  updateUserSettingsResponseSchema,
  updateUserSettingsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineSingleton } from "~/infrastructure/http/resource";
import {
  exportAccountData,
  exportAccountFiles,
} from "~/modules/account/application/exportAccountData";
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
      "Returns a ZIP archive of what the signed-in person made, with a manifest of every section and anything left out. When more files remain, the X-Export-Next-After header holds the cursor for GET /account/export/files.",
    responses: { 200: { description: "ZIP archive of the person's data" } },
    handler: ({ serviceContext, user }) => exportAccountData(serviceContext, user),
  });
});

defineSingleton(app, { path: "/export/files", tags: ["account"] }, (files) => {
  files.read({
    auth: true,
    summary: "Export remaining files",
    description:
      "Returns the next ZIP of files for a large account. Repeat with the X-Export-Next-After cursor until the header is absent.",
    querySchema: accountExportFilesQuerySchema,
    responses: { 200: { description: "ZIP archive of the next batch of files" } },
    handler: ({ query, serviceContext, user }) =>
      exportAccountFiles(serviceContext, user, query.after),
  });
});

export default app;
