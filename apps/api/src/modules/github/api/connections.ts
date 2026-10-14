import {
  canAutoConnectGitHubApp,
  getGitHubAppCallbackUrl,
  getGitHubAppInstallUrl,
} from "@ngriffin_uk/polychat-ai-integrations";
import {
  autoConnectSchema,
  githubConnectionSchema,
  listPageOf,
  sandboxConnectionRepositoriesSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { requirePlan } from "~/middleware/requirePlan";
import {
  getGitHubAppConnectionForUserInstallation,
  listGitHubAppConnectionsForUser,
  listGitHubInstallationRepositoriesForUser,
} from "~/modules/github/application/connections";
import {
  deleteGitHubConnectionForUser,
  upsertGitHubConnectionFromDefaultAppForUser,
  upsertGitHubConnectionForUser,
} from "~/modules/github/application/manage-connections";

const app = new Hono();
const installationParamsSchema = z.object({
  installation_id: z.coerce.number().int().positive(),
});

app.use("/*", requirePlan("pro"));

defineResource(
  app,
  { path: "/github", idParam: "installation_id", tags: ["connections"] },
  (installations) => {
    installations
      .list({
        auth: true,
        summary: "List GitHub App connections",
        description:
          "The page also carries install_config: the GitHub App install link and whether installations of the default app can be connected without credentials.",
        handler: async ({ serviceContext, user }) => ({
          ...listPageOf(
            await listGitHubAppConnectionsForUser(serviceContext, user.id),
            (connection) => String(connection.installationId),
          ),
          install_config: {
            installUrl: getGitHubAppInstallUrl(serviceContext.env),
            canAutoConnect: canAutoConnectGitHubApp(serviceContext.env),
            callbackUrl: getGitHubAppCallbackUrl(serviceContext.env),
          },
        }),
      })
      .create({
        auth: true,
        summary: "Add or update a GitHub App connection",
        description:
          "Send appId and privateKey for your own GitHub App, or only installationId to connect an installation of the default app.",
        bodySchema: z.union([githubConnectionSchema, autoConnectSchema]),
        handler: async ({ body, serviceContext, user }) => {
          if ("appId" in body) {
            await upsertGitHubConnectionForUser(serviceContext, user.id, body);
          } else {
            await upsertGitHubConnectionFromDefaultAppForUser(serviceContext, user.id, {
              installationId: body.installationId,
              repositories: body.repositories,
            });
          }

          return { connected: true };
        },
      })
      .delete({
        auth: true,
        summary: "Remove a GitHub App connection",
        paramSchema: installationParamsSchema,
        handler: async ({ params, serviceContext, user }) => {
          await deleteGitHubConnectionForUser(serviceContext, user.id, params.installation_id);

          return { deleted: true };
        },
      });

    installations
      .singleton("repositories")
      .read({
        auth: true,
        summary: "List repositories available to an installation",
        paramSchema: installationParamsSchema,
        handler: async ({ params, serviceContext, user }) => ({
          repositories: await listGitHubInstallationRepositoriesForUser(
            serviceContext,
            user.id,
            params.installation_id,
          ),
        }),
      })
      .update({
        auth: true,
        summary: "Replace the repositories a connection may use",
        paramSchema: installationParamsSchema,
        bodySchema: sandboxConnectionRepositoriesSchema,
        handler: async ({ body, params, serviceContext, user }) => {
          const existing = await getGitHubAppConnectionForUserInstallation(
            serviceContext,
            user.id,
            params.installation_id,
          );

          await upsertGitHubConnectionForUser(serviceContext, user.id, {
            installationId: params.installation_id,
            appId: existing.appId,
            privateKey: existing.privateKey,
            webhookSecret: existing.webhookSecret,
            repositories: body.repositories,
          });

          return { updated: true };
        },
      });
  },
);

export default app;
