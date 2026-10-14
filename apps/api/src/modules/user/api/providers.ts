import {
  listPageOf,
  providerParamsSchema,
  providerSyncStatusSchema,
  updateProviderCredentialsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import {
  deleteProviderApiKey,
  getUserProviderSettings,
  getUserProviderSyncStatus,
  storeProviderApiKey,
  syncUserProviders,
} from "~/modules/user/application/userOperations";

const app = new Hono();

defineResource(app, { idParam: "provider_id", tags: ["account"] }, (providers) => {
  providers
    .list({
      auth: true,
      summary: "List the providers the user can configure",
      description:
        "The page also carries sync_status: whether the user's catalogue is missing configurable providers.",
      handler: async ({ serviceContext, user }) => {
        const [settings, syncStatus] = await Promise.all([
          getUserProviderSettings(serviceContext, user.id),
          getUserProviderSyncStatus(serviceContext, user.id),
        ]);

        return {
          ...listPageOf(settings, (provider) => String(provider.provider_id)),
          sync_status: providerSyncStatusSchema.parse(syncStatus),
        };
      },
    })
    .collectionAction("sync", {
      auth: true,
      summary: "Sync providers",
      description: "Adds any configurable provider the user does not have yet.",
      handler: ({ serviceContext, user }) => syncUserProviders(serviceContext, user.id),
    })
    .update({
      auth: true,
      summary: "Store a provider's credentials",
      paramSchema: providerParamsSchema,
      bodySchema: updateProviderCredentialsSchema,
      handler: ({ serviceContext, params, body, user }) =>
        storeProviderApiKey(
          serviceContext,
          params.provider_id,
          body.apiKey,
          body.secretKey ?? undefined,
          body.configuration,
          user.id,
        ),
    })
    .delete({
      auth: true,
      summary: "Delete a provider's credentials",
      description: "Deletes the stored key and disables the provider for the user.",
      paramSchema: providerParamsSchema,
      handler: ({ serviceContext, params, user }) =>
        deleteProviderApiKey(serviceContext, params.provider_id, user.id),
    });
});

export default app;
